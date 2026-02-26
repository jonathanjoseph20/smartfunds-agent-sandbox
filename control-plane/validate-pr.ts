// DEBUG: ensure CI prints a real stack trace
process.on("uncaughtException", (err) => {
  console.error(err && (err.stack || err));
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error(err && (err.stack || err));
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';

import {

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
  buildBootstrapActions,
  buildEvidenceBlockAction,
  buildGovernanceReport,
  buildStalePayloadActions,
  getMissingTierLabels,
  loadRiskContract,
  resolveDeclaredTier,
  selectPrimaryAction,
  shouldWarnStalePayload,
  stringifyGovernanceReport,
  validatePrData,
  type GovernanceReport,
  type PullRequestData,
  type RiskContract
} from './governance/diagnostics.ts';
import { evaluateModePolicy } from './governance/mode-policy.ts';
import { resolveRailBindingDiagnostics } from './governance/rail-binding.ts';
import { resolveEntityTelemetry } from './studio/entity-registry.ts';
import { computeExecutionModesTouched, enforceModeBoundary } from './studio/mode-boundary.ts';
import { loadProjectsFromDir, loadTeamsFromDir, type Project, type Team } from './studio/registry.ts';
import { buildOwnershipErrors, resolveOwnership, type OwnershipResult } from './studio/ownership.ts';
import { resolveTeamsTouched } from './studio/team-ownership.ts';
import { loadSwarmsFromDir } from './swarms/registry.ts';
import { resolveSwarmsForProjects } from './swarms/resolution.ts';
import type { SwarmDefinition } from './swarms/types.ts';
import { TEAM_REGISTRY } from './teams/registry.ts';
import { resolveTeamsForChangedFiles } from './teams/team-resolver.ts';

function needsBootstrapAction(missingLabels: string[]): boolean {
  const required = new Set(['tier-0', 'tier-1', 'tier-2', 'tier-3', 'tier-3-approved', 'codex']);
  return missingLabels.some((label) => required.has(label));
}

function buildNextActions(
  result: ReturnType<typeof validatePrData>,
  pr: PullRequestData,
  repo?: string
): string[] {
  const actions: string[] = [];

  if (result.tierLabel === undefined) {
    actions.push('Add exactly one label: tier-0, tier-1, tier-2, tier-3.');
  }

  if (result.tierLabel !== undefined && result.tierBodyLabel !== undefined && result.tierBodyLabel !== result.tierLabel) {
    actions.push(`Update unfenced PR body declaration to tier-${result.tierLabel}.`);
  }

  if (result.tierLabel !== undefined && result.tierBody !== undefined && result.tierBody !== result.tierLabel) {
    actions.push(`Update PR body evidence Risk Tier to ${result.tierLabel}.`);
  }

  if (result.missingEvidenceFields.length > 0) {
    actions.push(buildEvidenceBlockAction());
  }

  if (result.tierLabel !== undefined && result.tierLabel < result.impliedTier) {
    actions.push(`Update label to tier-${result.impliedTier} and align PR body evidence.`);
  }

  if (result.tierLabel === 3 && !pr.labels.includes('tier-3-approved')) {
    actions.push('Add label: tier-3-approved.');
  }

  if (needsBootstrapAction(getMissingTierLabels(result.tierLabel ?? null)) ||
      (result.tierLabel === 3 && !pr.labels.includes('tier-3-approved'))) {
    actions.push(...buildBootstrapActions(repo));
  }

  return actions;
}

function buildWarnings(errors: string[]): string[] {
  const warnings: string[] = [];
  if (shouldWarnStalePayload(errors)) {
    warnings.push(
      'GitHub Actions re-runs can read stale PR body/labels. If you updated metadata, push a new commit to refresh the payload.'
    );
  }
  return warnings;
}

function buildTeamOwnershipErrors(status: ReturnType<typeof resolveTeamsTouched>['teamOwnershipStatus']): string[] {
  switch (status) {
    case 'ambiguous_team_ownership':
      return ['Team ownership violation: ambiguous team ownership detected.'];
    case 'unowned_files':
      return ['Team ownership violation: unowned files detected.'];
    default:
      return [];
  }
}

function renderSummary(result: GovernanceReport, status: 'PASS' | 'FAIL', primaryAction: string | null): string {
  const lines: string[] = [];
  lines.push(`Result: ${status}`);
  lines.push(`Declared Tier: ${result.declaredTier ?? 'n/a'}`);
  lines.push(`Label Tier: ${result.labelTier ?? 'n/a'}`);
  lines.push(`Implied Tier: ${result.impliedTier ?? 'n/a'}`);
  lines.push(`Fix: ${primaryAction ?? 'None'}`);
  return lines.join('\n');
}

function writeStepSummary(result: GovernanceReport, status: 'PASS' | 'FAIL', primaryAction: string | null): void {
  if (process.env.GOVERNANCE_SUMMARY === 'false') {
    return;
  }
  const outputPath = process.env.GITHUB_STEP_SUMMARY;
  if (!outputPath) {
    return;
  }
  const summary = renderSummary(result, status, primaryAction);
  fs.appendFileSync(outputPath, `${summary}\n`);
}

async function githubGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}

export async function fetchPrDataFromGitHub(): Promise<PullRequestData> {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!token || !repository || !eventPath) {
    throw new Error('Missing required env vars: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH.');
  }

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8')) as {
    pull_request?: { number?: number };
  };
  const prNumber = event.pull_request?.number;

  if (!prNumber) {
    throw new Error('This validator must run on pull_request events.');
  }

  const [owner, repo] = repository.split('/');
  const pr = await githubGet<{ body: string | null; labels: Array<{ name: string }> }>(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    token
  );

  const changedFiles: string[] = [];
  let page = 1;

  while (true) {
    const files = await githubGet<Array<{ filename: string }>>(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      token
    );

    if (files.length === 0) {
      break;
    }

    changedFiles.push(...(Array.isArray(files) ? files : []).map((file) => file.filename));
    if (files.length < 100) {
      break;
    }
    page += 1;
  }

  return {
    body: pr.body ?? '',
    labels: (Array.isArray(pr.labels) ? pr.labels : []).map((label) => label.name),
    changedFiles
  };
}

function buildReport(
  prData: PullRequestData,
  contract: RiskContract,
  repo?: string
): { report: GovernanceReport; errors: string[] } {
  const result = validatePrData(prData, contract);
  let ownershipResult: OwnershipResult;
  let projects: Project[] = [];
  let teams: Team[] = [];
  let swarms: SwarmDefinition[] = [];
  const errors: string[] = [...result.errors];
  try {
    projects = loadProjectsFromDir('control-plane/projects');
    teams = loadTeamsFromDir('control-plane/teams', projects);
    ownershipResult = resolveOwnership({ changedFiles: prData.changedFiles, projects, teams });
  } catch (error) {
    errors.push((error as Error).message);
    ownershipResult = resolveOwnership({ changedFiles: prData.changedFiles, projects: [], teams: [] });
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
  const declaredTier = resolveDeclaredTier({ tierBody: result.tierBody, tierBodyLabel: result.tierBodyLabel });
  const labelTier = result.tierLabel ?? null;
  const impliedTier = result.impliedTier;
  const missingLabels = [
    ...getMissingTierLabels(labelTier),
    ...(labelTier === 3 && !prData.labels.includes('tier-3-approved') ? ['tier-3-approved'] : [])
  ];

  const teamResolution = resolveTeamsForChangedFiles(prData.changedFiles);
  const teamOwnership = resolveTeamsTouched(prData.changedFiles, TEAM_REGISTRY);
  errors.push(...buildTeamOwnershipErrors(teamOwnership.teamOwnershipStatus));

  let executionModesTouched: ReturnType<typeof computeExecutionModesTouched> = [];
  let modeBoundaryStatus: ReturnType<typeof enforceModeBoundary>;
  try {
    executionModesTouched = computeExecutionModesTouched(teamOwnership.teamsTouched, TEAM_REGISTRY);
    modeBoundaryStatus = enforceModeBoundary(
      executionModesTouched,
      teamOwnership.teamsTouched,
      prData.changedFiles
    );
  } catch (error) {
    errors.push((error as Error).message);
    modeBoundaryStatus = { modeBoundaryStatus: 'ok' };
  }

  const modePolicy = evaluateModePolicy({
    executionModesTouched,
    declaredTier
  });
  if (modePolicy.status === 'failed' && modePolicy.message) {
    errors.push(modePolicy.message);
  }
  const railBindingResult = resolveRailBindingDiagnostics(entityTelemetryResult.telemetry.entitiesTouched);
  const nextActions = buildNextActions(result, prData, repo);
  nextActions.push(...(modeBoundaryStatus.nextActions ?? []));
  nextActions.push(...modePolicy.nextActions);
  nextActions.push(...ownershipResult.nextActions);
  nextActions.push(...entityTelemetryResult.nextActions);
  nextActions.push(...railBindingResult.nextActions);
  const warnings = [
    ...buildWarnings(result.errors),
    ...entityTelemetryResult.warnings,
    ...railBindingResult.warnings
  ];
  if (warnings.length > 0) {
    nextActions.push(...buildStalePayloadActions());
  }

  const swarmResolution = resolveSwarmsForProjects(ownershipResult.projectsTouched, swarms);

  return {
    report: buildGovernanceReport({
      declaredTier,
      impliedTier,
      labelTier,
      missingLabels,
      missingEvidenceFields: result.missingEvidenceFields,
      requiredChecks: result.requiredChecks,
      projectsTouched: ownershipResult.projectsTouched,
      swarmsTouched: swarmResolution.swarmsTouched,
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
      nextActions,
      warnings,
      teamsTouched: teamOwnership.teamsTouched,
      executionModesTouched,
      modeBoundaryStatus: modeBoundaryStatus.modeBoundaryStatus,
      conflictingTeams: modeBoundaryStatus.conflictingTeams ?? [],
      conflictingPaths: modeBoundaryStatus.conflictingPaths ?? [],
      swarmExecutionModesTouched: swarmResolution.swarmExecutionModesTouched,
      modeWarnings: teamResolution.modeWarnings,
      unownedPaths: teamResolution.unownedPaths,
      ambiguousPaths: teamResolution.ambiguousPaths
    }),
    errors
  };
}

async function main(): Promise<void> {
  const contract = loadRiskContract(path.resolve('control-plane/risk-contract.json'));
  const prData = await fetchPrDataFromGitHub();
  const repo = process.env.GITHUB_REPOSITORY;
  const { report, errors } = buildReport(prData, contract, repo);
  const ok =
    errors.length === 0 && report.modeEnforcementStatus === 'ok' && report.modeBoundaryStatus === 'ok';
  const status: 'PASS' | 'FAIL' = ok ? 'PASS' : 'FAIL';
  const primaryAction = selectPrimaryAction(report.nextActions);

  writeStepSummary(report, status, primaryAction);

  if (!ok) {
    console.error('Governance validation failed.');
    if (report.modeBoundaryStatus === 'multi_mode_conflict') {
      console.error(
        `Mode boundary violation: PR touches multiple execution modes (${report.executionModesTouched.join(' + ')}).`
      );
      console.error('Split this PR into separate mode-specific changes.');
    }
    console.error(
      `Declared Tier: ${report.declaredTier ?? 'n/a'} | Label Tier: ${report.labelTier ?? 'n/a'} | Implied Tier: ${report.impliedTier ?? 'n/a'}`
    );
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error('GOVERNANCE_REPORT_JSON_START');
    console.error(stringifyGovernanceReport(report));
    console.error('GOVERNANCE_REPORT_JSON_END');
    process.exit(1);
  }

  if (report.labelTier === null) {
    throw new Error('Unexpected state: tier label not resolved after validation.');
  }

  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, `tier=${report.labelTier}\n`);
    fs.appendFileSync(outputPath, `detected_tier=${report.labelTier}\n`);
    fs.appendFileSync(outputPath, `implied_tier=${report.impliedTier}\n`);
    fs.appendFileSync(outputPath, `required_checks=${report.requiredChecks.join(',')}\n`);
  }

  console.log(
    `PR governance validation passed with tier-${report.labelTier} (implied tier-${report.impliedTier}). Required checks: ${report.requiredChecks.join(', ')}`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
