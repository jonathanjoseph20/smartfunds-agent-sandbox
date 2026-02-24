import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  buildEvidenceBlockAction,
  buildGovernanceReport,
  buildStalePayloadActions,
  extractTierLabelFromBody,
  extractTierFromEvidence,
  getRequiredChecksForTier,
  inferImpliedTier,
  loadRiskContract,
  resolveDeclaredTier,
  shouldWarnStalePayload,
  stringifyGovernanceReport,
  validateEvidenceBlockSchema,
  type GovernanceReport,
  type Tier
} from '../governance/diagnostics.ts';
import { loadProjectsFromDir, loadTeamsFromDir, type Project, type Team } from '../studio/registry.ts';
import { buildOwnershipErrors, resolveOwnership, type OwnershipResult } from '../studio/ownership.ts';
import { resolveTeamsForChangedFiles } from '../teams/team-resolver.ts';

type GitExec = (args: string[]) => string;

type FileStat = { mtimeMs: number };

type PreflightDependencies = {
  gitExec?: GitExec;
  readFile?: (filePath: string) => string;
  statSync?: (filePath: string) => FileStat;
  existsSync?: (filePath: string) => boolean;
  loadProjects?: () => Project[];
  loadTeams?: (projects: Project[]) => Team[];
  resolveOwnership?: (params: { changedFiles: string[]; projects: Project[]; teams: Team[] }) => OwnershipResult;
};

type PreflightResult = {
  ok: boolean;
  report: GovernanceReport;
  errors: string[];
  changedFiles: string[];
  declaredTier: Tier | null;
  impliedTier: Tier;
  evidenceMissingFields: string[];
  ownership: OwnershipResult;
  tier3Approval: { required: boolean; satisfied: boolean };
  nextActions: string[];
  warnings: string[];
};

const BODY_FILE = '.pr-body.md';
const LABELS_FILE = '.pr-labels.txt';
const METADATA_MARKER = '.governance-metadata-changed';

function defaultGitExec(args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    const stdout = (error as { stdout?: string | Buffer }).stdout;
    if (typeof stdout === 'string') {
      return stdout.trim();
    }
    if (Buffer.isBuffer(stdout)) {
      return stdout.toString('utf8').trim();
    }
    throw error;
  }
}

function getChangedFiles(execGit: GitExec): string[] {
  const output = execGit(['diff', '--name-only', 'main...HEAD']);
  if (!output) {
    return [];
  }
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function getBranchName(execGit: GitExec): string {
  return execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
}

function getHeadCommitTime(execGit: GitExec): number {
  const output = execGit(['show', '-s', '--format=%ct', 'HEAD']);
  const parsed = Number.parseInt(output, 10);
  if (Number.isNaN(parsed)) {
    throw new Error('Unable to determine HEAD commit time.');
  }
  return parsed * 1000;
}

function readFileIfExists(readFile: (filePath: string) => string, existsSync: (filePath: string) => boolean, filePath: string): string {
  if (!existsSync(filePath)) {
    return '';
  }
  return readFile(filePath);
}

function parseLabelsFile(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripFencedBlocks(body: string): string {
  return body.replace(/```[\s\S]*?```/g, '');
}

function hasUnfencedToken(body: string, token: string): boolean {
  const outside = stripFencedBlocks(body);
  return new RegExp(`\\b${token}\\b`, 'i').test(outside);
}

function resolveOwnershipResult(
  changedFiles: string[],
  deps: Required<Pick<PreflightDependencies, 'loadProjects' | 'loadTeams' | 'resolveOwnership'>>,
  errors: string[]
): OwnershipResult {
  let ownershipResult: OwnershipResult;
  try {
    const projects = deps.loadProjects();
    const teams = deps.loadTeams(projects);
    ownershipResult = deps.resolveOwnership({ changedFiles, projects, teams });
  } catch (error) {
    errors.push((error as Error).message);
    ownershipResult = resolveOwnership({ changedFiles, projects: [], teams: [] });
  }
  errors.push(...buildOwnershipErrors(ownershipResult));
  return ownershipResult;
}

function buildNextActions(params: {
  declaredTier: Tier | null;
  impliedTier: Tier;
  evidenceErrors: string[];
  missingEvidenceFields: string[];
  tierBodyLabel: Tier | undefined;
  tierBody: Tier | undefined;
  tier3ApprovalRequired: boolean;
  tier3ApprovalSatisfied: boolean;
  ownershipActions: string[];
}): string[] {
  const actions: string[] = [];

  if (!params.tierBodyLabel) {
    actions.push('Add unfenced PR body tier declaration (tier-0..tier-3).');
  }

  if (params.missingEvidenceFields.length > 0 || params.evidenceErrors.length > 0) {
    actions.push(buildEvidenceBlockAction());
  }

  if (params.tierBody !== undefined && params.tierBodyLabel !== undefined && params.tierBody !== params.tierBodyLabel) {
    actions.push(`Update PR body evidence Risk Tier to ${params.tierBodyLabel}.`);
  }

  if (params.declaredTier !== null && params.declaredTier < params.impliedTier) {
    actions.push(`Update PR body Risk Tier to ${params.impliedTier} and apply matching tier label.`);
  }

  if (params.tier3ApprovalRequired && !params.tier3ApprovalSatisfied) {
    actions.push(
      "Tier 3 requires tier-3-approved. Add an unfenced line 'tier-3-approved' to .pr-body.md (local only) or create .pr-labels.txt listing tier-3-approved."
    );
  }

  actions.push(...params.ownershipActions);
  return actions;
}

export function buildPreflightReport(
  body: string,
  changedFiles: string[],
  labelNames: string[],
  deps: PreflightDependencies = {}
): PreflightResult {
  const errors: string[] = [];
  const contract = loadRiskContract(path.resolve('control-plane/risk-contract.json'));

  const evidenceValidation = validateEvidenceBlockSchema(body);
  const evidenceErrors = [...evidenceValidation.errors];
  const missingEvidenceFields = evidenceValidation.missingFields;
  errors.push(...evidenceErrors);

  let tierBodyLabel: Tier | undefined;
  try {
    tierBodyLabel = extractTierLabelFromBody(body);
  } catch (error) {
    errors.push((error as Error).message);
  }

  if (tierBodyLabel === undefined) {
    errors.push('Missing unfenced PR body tier declaration. Include exactly one plain-text `tier-0`..`tier-3` in the PR body.');
  }

  const tierBody = extractTierFromEvidence(body);
  if (evidenceValidation.evidence && tierBody === undefined) {
    errors.push('Evidence block must include `Risk Tier: <0|1|2|3>`.');
  }

  if (tierBody !== undefined && tierBodyLabel !== undefined && tierBody !== tierBodyLabel) {
    errors.push(
      `Risk tier mismatch: PR body evidence Risk Tier is ${tierBody}; update to match unfenced tier-${tierBodyLabel}.`
    );
  }

  const { impliedTier, escalationFiles } = inferImpliedTier(changedFiles, contract);
  const declaredTier = resolveDeclaredTier({ tierBody, tierBodyLabel });
  const labelTier = declaredTier;

  if (labelTier !== null && labelTier < impliedTier) {
    errors.push(
      `Declared tier-${labelTier} is below implied tier-${impliedTier}. Escalating files: ${escalationFiles.join(', ')}.`
    );
  }

  const tier3ApprovalRequired = declaredTier === 3;
  const tier3ApprovalSatisfied = tier3ApprovalRequired
    ? hasUnfencedToken(body, 'tier-3-approved') || labelNames.includes('tier-3-approved')
    : true;

  if (tier3ApprovalRequired && !tier3ApprovalSatisfied) {
    errors.push(
      "Tier 3 requires tier-3-approved. Add an unfenced line 'tier-3-approved' to .pr-body.md (local only) or create .pr-labels.txt listing tier-3-approved."
    );
  }

  const requiredChecks = labelTier !== null ? getRequiredChecksForTier(labelTier, contract) : [];

  const ownershipResolver = deps.resolveOwnership ?? resolveOwnership;
  const ownershipResult = resolveOwnershipResult(
    changedFiles,
    {
      loadProjects: deps.loadProjects ?? (() => loadProjectsFromDir('control-plane/projects')),
      loadTeams: deps.loadTeams ?? ((projects) => loadTeamsFromDir('control-plane/teams', projects)),
      resolveOwnership: ownershipResolver
    },
    errors
  );

  const missingLabels = tier3ApprovalRequired && !tier3ApprovalSatisfied ? ['tier-3-approved'] : [];
  const teamResolution = resolveTeamsForChangedFiles(changedFiles);

  const warnings = shouldWarnStalePayload(errors)
    ? ['GitHub Actions re-runs can read stale PR body/labels. If you updated metadata, push a new commit to refresh the payload.']
    : [];

  const nextActions = buildNextActions({
    declaredTier,
    impliedTier,
    evidenceErrors,
    missingEvidenceFields,
    tierBodyLabel,
    tierBody,
    tier3ApprovalRequired,
    tier3ApprovalSatisfied,
    ownershipActions: ownershipResult.nextActions
  });

  if (warnings.length > 0) {
    nextActions.push(...buildStalePayloadActions());
  }

  const report = buildGovernanceReport({
    declaredTier,
    impliedTier,
    labelTier,
    missingLabels,
    missingEvidenceFields,
    requiredChecks,
    projectsTouched: ownershipResult.projectsTouched,
    teamsTouched: teamResolution.teamsTouched,
    unownedFiles: ownershipResult.unownedFiles,
    ownershipStatus: ownershipResult.ownershipStatus,
    nextActions,
    warnings,
    executionModesTouched: teamResolution.executionModesTouched,
    modeWarnings: teamResolution.modeWarnings,
    unownedPaths: teamResolution.unownedPaths,
    ambiguousPaths: teamResolution.ambiguousPaths
  });

  return {
    ok: errors.length === 0,
    report,
    errors,
    changedFiles,
    declaredTier,
    impliedTier,
    evidenceMissingFields: missingEvidenceFields,
    ownership: ownershipResult,
    tier3Approval: { required: tier3ApprovalRequired, satisfied: tier3ApprovalSatisfied },
    nextActions,
    warnings
  };
}

export function shouldWarnStaleMetadata(params: {
  bodyMtimeMs: number | null;
  headCommitMs: number;
  markerExists: boolean;
  declaredTier: Tier | null;
  tier3ApprovalSatisfied: boolean;
}): boolean {
  const bodyNewer = params.bodyMtimeMs !== null && params.bodyMtimeMs > params.headCommitMs;
  const approvalMismatch = params.declaredTier === 3 && !params.tier3ApprovalSatisfied;
  return bodyNewer || params.markerExists || approvalMismatch;
}

function renderSummary(result: PreflightResult, branch: string): string {
  const lines: string[] = [];
  lines.push(`Branch: ${branch} (base: main)`);
  lines.push(`Changed files: ${result.changedFiles.length}`);
  lines.push(`Declared Tier: ${result.declaredTier ?? 'n/a'}`);
  lines.push(`Implied Tier: ${result.impliedTier ?? 'n/a'}`);
  lines.push(`Projects Touched: ${result.report.projectsTouched.join(', ') || 'none'}`);
  lines.push(`Teams Touched: ${result.report.teamsTouched.join(', ') || 'none'}`);
  lines.push(`Execution Modes: ${result.report.executionModesTouched.join(', ') || 'none'}`);
  lines.push(`Mode Warnings: ${result.report.modeWarnings.join(', ') || 'none'}`);
  lines.push(`Ownership Status: ${result.report.ownershipStatus}`);

  if (result.evidenceMissingFields.length > 0) {
    lines.push(`Evidence: missing fields (${result.evidenceMissingFields.join(', ')})`);
  } else if (result.errors.some((error) => error.includes('Missing fenced evidence block'))) {
    lines.push('Evidence: missing block');
  } else {
    lines.push('Evidence: ok');
  }

  if (result.tier3Approval.required) {
    lines.push(`Tier-3 approval: ${result.tier3Approval.satisfied ? 'ok' : 'missing'}`);
  }

  if (result.nextActions.length > 0) {
    lines.push('Next actions:');
    for (const action of result.nextActions) {
      lines.push(`- ${action}`);
    }
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const gitExec = defaultGitExec;
  const readFile = (filePath: string) => fs.readFileSync(filePath, 'utf8');
  const statSync = (filePath: string) => fs.statSync(filePath);
  const existsSync = (filePath: string) => fs.existsSync(filePath);

  const branch = getBranchName(gitExec);
  const changedFiles = getChangedFiles(gitExec);
  const body = readFileIfExists(readFile, existsSync, BODY_FILE);
  const labels = parseLabelsFile(readFileIfExists(readFile, existsSync, LABELS_FILE));

  const result = buildPreflightReport(body, changedFiles, labels, {
    readFile,
    statSync,
    existsSync
  });

  const summary = renderSummary(result, branch);
  console.log(summary);

  const headCommitMs = getHeadCommitTime(gitExec);
  const bodyMtimeMs = existsSync(BODY_FILE) ? statSync(BODY_FILE).mtimeMs : null;
  const markerExists = existsSync(METADATA_MARKER);

  if (shouldWarnStaleMetadata({
    bodyMtimeMs,
    headCommitMs,
    markerExists,
    declaredTier: result.declaredTier,
    tier3ApprovalSatisfied: result.tier3Approval.satisfied
  })) {
    console.log('');
    console.log('⚠ Governance metadata may be stale in GitHub.');
    console.log('If you modified labels or PR body after CI failure, run:');
    console.log('');
    console.log('git commit --allow-empty -m "chore: refresh governance metadata"');
    console.log('git push');
  }

  console.log('GOVERNANCE_REPORT_JSON_START');
  console.log(stringifyGovernanceReport(result.report));
  console.log('GOVERNANCE_REPORT_JSON_END');

  if (!result.ok) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
