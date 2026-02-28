import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  buildBootstrapActions,
  buildEvidenceBlockAction,
  buildGovernanceReport,
  buildStalePayloadActions,
  extractTierLabelFromBody,
  extractTierFromEvidence,
  getRequiredChecksForTier,
  inferImpliedTier,
  loadRiskContract,
  resolveDeclaredTier,
  selectPrimaryAction,
  stringifyGovernanceReport,
  validateEvidenceBlockSchema,
  type GovernanceReport,
  type Tier
} from './governance/diagnostics.ts';
import { resolveLocalMetadata } from './governance/metadata-resolution.ts';
import { evaluateModePolicy } from './governance/mode-policy.ts';
import { resolveRailBindingDiagnostics } from './governance/rail-binding.ts';
import { REQUIRED_LABELS } from './bootstrap-labels.ts';
import { resolveEntityTelemetry } from './studio/entity-registry.ts';
import { parseSwarmEvidenceMetadata } from './swarm/parser.ts';
import { evaluateSwarmPolicy } from './swarm/validator.ts';
import { loadProjectsFromDir, loadTeamsFromDir, type Project, type Team } from './studio/registry.ts';
import { buildOwnershipErrors, resolveOwnership, type OwnershipResult } from './studio/ownership.ts';
import { loadSwarmsFromDir } from './swarms/registry.ts';
import { resolveSwarmsForProjects } from './swarms/resolution.ts';
import { evaluateSwarmOrchestration } from './swarms/orchestration.ts';
import type { SwarmDefinition } from './swarms/types.ts';
import { resolveTeamsForChangedFiles } from './teams/team-resolver.ts';
import { classifyIsolation, type ClassifyIsolationArgs } from './isolation/path-classifier.ts';
import type { IsolationClassification } from './isolation/types.ts';

type GitExec = (args: string[]) => string;

type GovernanceCheckOptions = {
  bodyFile?: string;
  labelsFile?: string;
  repo?: string;
  token?: string;
  branchName?: string;
  gitExec?: GitExec;
  readFile?: (filePath: string) => string;
  existsSync?: (filePath: string) => boolean;
  fetchImpl?: typeof fetch;
};

type LabelInfo = {
  name: string;
};

export const ISOLATION_REMEDIATION_ACTION =
  'Autonomous contexts (swarm/*) must not touch structured paths; move change to structured branch or restrict task to autonomous paths.';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function defaultGitExec(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function getBranchName(execGit: GitExec): string {
  return execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
}

function parseArgs(argv: string[]): { bodyFile?: string; labelsFile?: string } {
  let bodyFile: string | undefined;
  let labelsFile: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--body-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --body-file.');
      }
      bodyFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--body-file=')) {
      bodyFile = arg.slice('--body-file='.length);
      if (!bodyFile) {
        throw new Error('Missing value for --body-file.');
      }
      continue;
    }
    if (arg === '--labels-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --labels-file.');
      }
      labelsFile = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--labels-file=')) {
      labelsFile = arg.slice('--labels-file='.length);
      if (!labelsFile) {
        throw new Error('Missing value for --labels-file.');
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { bodyFile, labelsFile };
}

function resolveMergeBase(execGit: GitExec): string {
  const candidates = ['upstream/main', 'origin/main', 'main'];
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return execGit(['merge-base', 'HEAD', candidate]);
    } catch (error) {
      errors.push(`${candidate}: ${(error as Error).message}`);
    }
  }

  throw new Error(`Unable to resolve merge-base against ${candidates.join(', ')}. ${errors.join(' | ')}`);
}

function collectChangedFiles(execGit: GitExec, baseSha: string): string[] {
  const output = execGit(['diff', '--name-only', baseSha, 'HEAD']);
  if (!output) {
    return [];
  }
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function buildIsolationErrorMessage(classification: IsolationClassification): string {
  const statusCode = `isolation_violation:${classification.isolationStatus}`;
  if (classification.isolationStatus === 'invalid_autonomous_branch_namespace') {
    return `${statusCode}: swarm branch must match swarm/<task> where <task> is [a-z0-9._-]+.`;
  }

  const structuredPaths = sortedUnique(classification.structuredPathsTouched);
  return `${statusCode}: autonomous context may not modify structured paths: ${structuredPaths.join(', ')}`;
}

export function buildIsolationEnforcement(args: {
  branchName: string;
  changedFiles: string[];
  executionMode: 'structured' | 'autonomous' | 'unknown';
}): {
  classification: IsolationClassification;
  errors: string[];
  nextActions: string[];
} {
  const classifyArgs: ClassifyIsolationArgs = {
    branchName: args.branchName,
    changedFiles: args.changedFiles,
    executionMode: args.executionMode
  };
  const classification = classifyIsolation(classifyArgs);

  if (!classification.autonomousContextDetected || classification.isolationStatus === 'ok') {
    return {
      classification,
      errors: [],
      nextActions: []
    };
  }

  return {
    classification,
    errors: [buildIsolationErrorMessage(classification)],
    nextActions: [ISOLATION_REMEDIATION_ACTION]
  };
}

async function fetchRepoLabels(fetchImpl: typeof fetch, repo: string, token: string): Promise<string[]> {
  const labels: string[] = [];
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid repo value: ${repo}. Expected owner/name.`);
  }
  let page = 1;

  while (true) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${owner}/${name}/labels?per_page=100&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${message}`);
    }

    const pageLabels = (await response.json()) as LabelInfo[];
    labels.push(...pageLabels.map((label) => label.name));

    if (pageLabels.length < 100) {
      break;
    }
    page += 1;
  }

  return labels;
}

function buildWarnings(hasLabelCheck: boolean): string[] {
  const warnings: string[] = [];
  if (!hasLabelCheck) {
    warnings.push(
      'Label existence not verified in local mode. Provide GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY to check labels, or run label bootstrap in dry-run.'
    );
  }
  warnings.push('Labels are authoritative in CI; local mode assumes label tier from the PR body.');
  return warnings;
}

function buildNextActions(
  declaredTier: Tier | null,
  impliedTier: Tier,
  evidenceErrors: string[],
  missingEvidenceFields: string[],
  tierBodyLabel: Tier | undefined,
  tierBody: Tier | undefined,
  repo?: string,
  missingRepoLabels: string[] = []
): string[] {
  const actions: string[] = [];

  if (!tierBodyLabel) {
    actions.push('Add unfenced PR body tier declaration (tier-0..tier-3).');
  }

  if (missingEvidenceFields.length > 0 || evidenceErrors.length > 0) {
    actions.push(buildEvidenceBlockAction());
  }

  if (tierBody !== undefined && tierBodyLabel !== undefined && tierBody !== tierBodyLabel) {
    actions.push(`Update PR body evidence Risk Tier to ${tierBodyLabel}.`);
  }

  if (declaredTier !== null && declaredTier < impliedTier) {
    actions.push(`Update PR body Risk Tier to ${impliedTier} and apply matching tier label.`);
  }

  if (declaredTier === 3) {
    actions.push('Add label: tier-3-approved.');
  }

  if (missingRepoLabels.length > 0) {
    actions.push(...buildBootstrapActions(repo));
  }

  return actions;
}

export async function runGovernanceCheck(options: GovernanceCheckOptions = {}): Promise<{
  ok: boolean;
  report: GovernanceReport;
  errors: string[];
}> {
  const gitExec = options.gitExec ?? defaultGitExec;
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, 'utf8'));
  const existsSync = options.existsSync ?? (options.readFile ? (() => true) : ((filePath: string) => fs.existsSync(filePath)));
  const fetchImpl = options.fetchImpl ?? fetch;
  const repo = options.repo ?? process.env.GITHUB_REPOSITORY;
  const token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const resolvedMetadata = resolveLocalMetadata({
    bodyFile: options.bodyFile,
    labelsFile: options.labelsFile,
    readFile,
    existsSync
  });
  const body = resolvedMetadata.body;

  const contract = loadRiskContract(path.resolve('control-plane/risk-contract.json'));
  const baseSha = resolveMergeBase(gitExec);
  const changedFiles = collectChangedFiles(gitExec, baseSha);
  const branchName = options.branchName ?? getBranchName(gitExec);

  const evidenceValidation = validateEvidenceBlockSchema(body);
  const evidenceErrors = [...evidenceValidation.errors];
  const missingEvidenceFields = evidenceValidation.missingFields;
  const errors: string[] = [...evidenceErrors];

  let ownershipResult: OwnershipResult;
  let projects: Project[] = [];
  let teams: Team[] = [];
  let swarms: SwarmDefinition[] = [];
  try {
    projects = loadProjectsFromDir('control-plane/projects');
    teams = loadTeamsFromDir('control-plane/teams', projects);
    ownershipResult = resolveOwnership({ changedFiles, projects, teams });
  } catch (error) {
    errors.push((error as Error).message);
    ownershipResult = resolveOwnership({ changedFiles, projects: [], teams: [] });
  }

  if (projects.length > 0) {
    try {
      swarms = loadSwarmsFromDir('control-plane/swarms', projects);
    } catch (error) {
      errors.push((error as Error).message);
      swarms = [];
    }
  }

  errors.push(...buildOwnershipErrors(ownershipResult));
  const entityTelemetryResult = resolveEntityTelemetry(ownershipResult.projectsTouched);

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

  const { impliedTier } = inferImpliedTier(changedFiles, contract);
  const declaredTier = resolveDeclaredTier({ tierBody, tierBodyLabel });
  const labelTier = declaredTier;

  if (labelTier !== null && labelTier < impliedTier) {
    errors.push(`Declared tier-${labelTier} is below implied tier-${impliedTier}.`);
  }

  const requiredChecks = labelTier !== null ? getRequiredChecksForTier(labelTier, contract) : [];

  let missingRepoLabels: string[] = [];
  let hasLabelCheck = false;
  if (token && repo) {
    const labelNames = await fetchRepoLabels(fetchImpl, repo, token);
    const requiredLabelNames = REQUIRED_LABELS.map((label) => label.name);
    const labelSet = new Set(labelNames);
    missingRepoLabels = requiredLabelNames.filter((label) => !labelSet.has(label));
    hasLabelCheck = true;
  }

  const warnings = buildWarnings(hasLabelCheck);
  const teamResolution = resolveTeamsForChangedFiles(changedFiles);
  const swarmMetadata = parseSwarmEvidenceMetadata(body);
  const swarmPolicy = evaluateSwarmPolicy({
    swarmsDeclared: swarmMetadata.swarmsDeclared,
    swarmMode: swarmMetadata.swarmMode,
    swarmTeamId: swarmMetadata.swarmTeamId,
    hasSwarmModeField: swarmMetadata.hasSwarmModeField,
    hasSwarmTeamField: swarmMetadata.hasSwarmTeamField,
    swarmWarnings: swarmMetadata.swarmWarnings,
    executionModesTouched: teamResolution.executionModesTouched
  });
  errors.push(...swarmPolicy.swarmErrors);
  const isolation = buildIsolationEnforcement({
    branchName,
    changedFiles,
    executionMode: swarmMetadata.swarmMode ?? 'unknown'
  });
  errors.push(...isolation.errors);
  const modePolicy = evaluateModePolicy({
    executionModesTouched: teamResolution.executionModesTouched,
    declaredTier
  });
  if (modePolicy.status === 'failed' && modePolicy.message) {
    errors.push(modePolicy.message);
  }
  const railBindingResult = resolveRailBindingDiagnostics(entityTelemetryResult.telemetry.entitiesTouched);
  const nextActions = buildNextActions(
    declaredTier,
    impliedTier,
    evidenceErrors,
    missingEvidenceFields,
    tierBodyLabel,
    tierBody,
    repo,
    missingRepoLabels
  );
  nextActions.push(...modePolicy.nextActions);
  nextActions.push(...ownershipResult.nextActions);
  nextActions.push(...entityTelemetryResult.nextActions);
  nextActions.push(...railBindingResult.nextActions);
  nextActions.push(...isolation.nextActions);

  if (errors.length > 0) {
    warnings.push(
      'If you updated PR body/labels after a failed run, push a new commit to refresh the PR payload before re-running.'
    );
    nextActions.push(...buildStalePayloadActions());
  }

  const swarmResolution = resolveSwarmsForProjects(ownershipResult.projectsTouched, swarms);
  const swarmsTouched = sortedUnique([...swarmResolution.swarmsTouched, ...swarmPolicy.swarmsTouched]);
  const orchestrationResult = evaluateSwarmOrchestration({
    swarmsTouched,
    swarms,
    registryPath: 'control-plane/swarms/orchestration.json'
  });
  if (orchestrationResult.status !== 'ok') {
    errors.push(...orchestrationResult.violations);
  }

  const report = buildGovernanceReport({
    declaredTier,
    impliedTier,
    labelTier,
    missingLabels: missingRepoLabels,
    missingEvidenceFields,
    requiredChecks,
    projectsTouched: ownershipResult.projectsTouched,
    teamsTouched: teamResolution.teamsTouched,
    unownedFiles: ownershipResult.unownedFiles,
    ownershipStatus: ownershipResult.ownershipStatus,
    entitiesTouched: entityTelemetryResult.telemetry.entitiesTouched,
    entityOwnershipStatus: entityTelemetryResult.telemetry.entityOwnershipStatus,
    unmappedProjects: entityTelemetryResult.telemetry.unmappedProjects,
    entityByProject: entityTelemetryResult.telemetry.entityByProject,
    entityRailProfileByEntity: railBindingResult.diagnostics.entityRailProfileByEntity,
    entitiesMissingRailProfile: railBindingResult.diagnostics.entitiesMissingRailProfile,
    railBindingStatus: railBindingResult.diagnostics.railBindingStatus,
    railViolations: railBindingResult.diagnostics.railViolations,
    autonomousContextDetected: isolation.classification.autonomousContextDetected,
    branchNamespaceValid: isolation.classification.branchNamespaceValid,
    structuredPathsTouched: isolation.classification.structuredPathsTouched,
    autonomousPathsTouched: isolation.classification.autonomousPathsTouched,
    isolationStatus: isolation.classification.isolationStatus,
    isolationViolations: isolation.classification.isolationViolations,
    nextActions,
    warnings: [...warnings, ...swarmPolicy.swarmWarnings, ...entityTelemetryResult.warnings, ...railBindingResult.warnings],
    executionModesTouched: teamResolution.executionModesTouched,
    swarmsDeclared: swarmMetadata.swarmsDeclared,
    swarmExecutionModesTouched: swarmResolution.swarmExecutionModesTouched,
    swarmsTouched,
    swarmOrchestrationStatus: orchestrationResult.status,
    swarmOrchestrationViolations: orchestrationResult.violations,
    swarmDependencyEdges: orchestrationResult.edges,
    swarmTopologicalOrder: orchestrationResult.topologicalOrder,
    swarmPhaseBySwarm: orchestrationResult.phaseBySwarm,
    ...(orchestrationResult.cycleDetected ? { swarmCycleDetected: orchestrationResult.cycleDetected } : {}),
    swarmWarnings: swarmPolicy.swarmWarnings,
    swarmMode: swarmMetadata.swarmMode,
    swarmTeamId: swarmMetadata.swarmTeamId,
    modeWarnings: teamResolution.modeWarnings,
    unownedPaths: teamResolution.unownedPaths,
    ambiguousPaths: teamResolution.ambiguousPaths,
    metadataSource: resolvedMetadata.metadataSource,
    executionContext: {
      context: 'local',
      executionMode: swarmMetadata.swarmMode ?? 'unknown',
      retryEnabled: false
    },
    retryTrace: {
      attempted: false,
      retryCount: 0,
      initialStatus: errors.length === 0 ? 'passed' : 'failed',
      finalStatus: errors.length === 0 ? 'passed' : 'failed',
      triggerErrorCode: null,
      retryable: false,
      patchApplied: null
    }
  });

  return {
    ok: errors.length === 0 && report.modeEnforcementStatus === 'ok',
    report,
    errors
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { ok, report, errors } = await runGovernanceCheck({ bodyFile: args.bodyFile, labelsFile: args.labelsFile });
  const status: 'PASS' | 'FAIL' = ok ? 'PASS' : 'FAIL';
  const primaryAction = selectPrimaryAction(report.nextActions);

  console.log(`Governance preflight ${status}.`);
  console.log(`Declared Tier: ${report.declaredTier ?? 'n/a'}`);
  console.log(`Label Tier: ${report.labelTier ?? 'n/a'}`);
  console.log(`Implied Tier: ${report.impliedTier ?? 'n/a'}`);
  console.log(`Fix: ${primaryAction ?? 'None'}`);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`- ${error}`);
    }
  }

  console.log('GOVERNANCE_REPORT_JSON_START');
  console.log(stringifyGovernanceReport(report));
  console.log('GOVERNANCE_REPORT_JSON_END');

  if (!ok) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}

export { parseArgs, resolveMergeBase, collectChangedFiles, getBranchName };
