import fs from 'node:fs';
import path from 'node:path';

import {
  buildBootstrapActions,
  buildGovernanceReport,
  buildStalePayloadActions,
  extractTierFromLabels,
  getRequiredChecksForTier,
  inferImpliedTier,
  loadRiskContract,
  selectPrimaryAction,
  stringifyGovernanceReport,
  type GovernanceReport,
  type Tier
} from './governance/diagnostics.ts';
import { resolveLocalMetadata } from './governance/metadata-resolution.ts';
import { evaluateModePolicy } from './governance/mode-policy.ts';
import { resolveRailBindingDiagnostics } from './governance/rail-binding.ts';
import { REQUIRED_LABELS } from './bootstrap-labels.ts';
import { resolveEntityTelemetry } from './studio/entity-registry.ts';
import { evaluateSwarmPolicy } from './swarm/validator.ts';
import { loadOwnershipProjects, loadProjectsFromDir, loadTeamsFromDir, type Project, type Team } from './studio/registry.ts';
import { buildOwnershipErrors, resolveOwnership, type OwnershipResult } from './studio/ownership.ts';
import { loadSwarmsFromDir } from './swarms/registry.ts';
import { resolveSwarmsForProjects } from './swarms/resolution.ts';
import { evaluateSwarmOrchestration } from './swarms/orchestration.ts';
import type { SwarmDefinition } from './swarms/types.ts';
import { resolveTeamsForChangedFiles } from './teams/team-resolver.ts';
import { classifyIsolation, type ClassifyIsolationArgs } from './isolation/path-classifier.ts';
import type { IsolationClassification } from './isolation/types.ts';

export const ISOLATION_REMEDIATION_ACTION =
  'Autonomous contexts (swarm/*) must not touch structured paths; move change to structured branch or restrict task to autonomous paths.';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function buildPodOwnership(projectsTouched: string[], projects: Project[]): {
  podsTouched: string[];
  podByProject: Record<string, string | null>;
} {
  const podByProject: Record<string, string | null> = {};
  const podByProjectId = new Map(projects.map((project) => [project.projectId, project.podId ?? null]));

  for (const projectId of sortedUnique(projectsTouched)) {
    podByProject[projectId] = podByProjectId.get(projectId) ?? null;
  }

  const podsTouched = sortedUnique(
    Object.values(podByProject).filter((value): value is string => value !== null)
  );

  return { podsTouched, podByProject };
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
  return getChangedFilesFromBase(execGit, baseSha);
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
    const response = await fetchWithGitHubRetry(
      fetchImpl,
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
  warnings.push('Labels are authoritative in CI; local mode expects labels aligned to governance/evidence.json.');
  return warnings;
}

function buildNextActions(
  declaredTier: Tier | null,
  impliedTier: Tier,
  repo?: string,
  missingRepoLabels: string[] = []
): string[] {
  const actions: string[] = [];

  if (declaredTier !== null && declaredTier < impliedTier) {
    actions.push(`Update governance/evidence.json tier to ${impliedTier} and apply matching tier label.`);
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
  const existsSync = options.existsSync ?? ((filePath: string) => {
    if (!options.readFile) {
      return fs.existsSync(filePath);
    }
    const knownStubbedPaths = new Set([
      options.bodyFile ?? 'pr-body.md',
      options.bodyFile ?? '.pr-body.md',
      options.labelsFile ?? '.pr-labels.txt',
      options.labelsFile ?? 'pr-labels.txt'
    ]);
    if (knownStubbedPaths.has(filePath)) {
      return true;
    }
    return fs.existsSync(filePath);
  });
  const fetchImpl = options.fetchImpl ?? fetch;
  const repo = options.repo ?? process.env.GITHUB_REPOSITORY;
  const token = options.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const resolvedMetadata = resolveLocalMetadata({
    bodyFile: options.bodyFile,
    labelsFile: options.labelsFile,
    readFile,
    existsSync
  });

  const contract = loadRiskContract(path.resolve('control-plane/risk-contract.json'));
  const baseSha = resolveMergeBase(gitExec);
  const changedFiles = collectChangedFiles(gitExec, baseSha);
  const branchName = options.branchName ?? getBranchName(gitExec);

  const evidenceContract = readEvidenceContract({ readFile, existsSync });
  const missingEvidenceFields: string[] = [];
  const errors: string[] = [];

  let ownershipResult: OwnershipResult;
  let ownershipProjects: Project[] = [];
  let ownershipTeams: Team[] = [];
  let swarmProjects: Project[] = [];
  let swarms: SwarmDefinition[] = [];
  try {
    ownershipProjects = loadOwnershipProjects();
  } catch (error) {
    errors.push((error as Error).message);
    ownershipProjects = [];
  }
  try {
    ownershipTeams = loadTeamsFromDir('control-plane/teams', ownershipProjects);
  } catch (error) {
    ownershipTeams = [];
  }
  ownershipResult = resolveOwnership({ changedFiles, projects: ownershipProjects, teams: ownershipTeams });
  const podOwnership = buildPodOwnership(ownershipResult.projectsTouched, ownershipProjects);

  try {
    swarmProjects = loadProjectsFromDir('control-plane/projects');
  } catch (error) {
    errors.push((error as Error).message);
    swarmProjects = [];
  }

  if (swarmProjects.length > 0) {
    try {
      swarms = loadSwarmsFromDir('control-plane/swarms', swarmProjects);
    } catch (error) {
      errors.push((error as Error).message);
      swarms = [];
    }
  }

  errors.push(...buildOwnershipErrors(ownershipResult));
  const entityTelemetryResult = resolveEntityTelemetry(ownershipResult.projectsTouched);

  const { impliedTier } = inferImpliedTier(changedFiles, contract);
  let declaredTier: Tier | null = null;
  let labelTier: Tier | null = null;
  let explicitLabelTier: Tier | null = null;
  if ('evidence' in evidenceContract) {
    declaredTier = evidenceContract.evidence.tier;
    try {
      explicitLabelTier = extractTierFromLabels(resolvedMetadata.labels) ?? null;
    } catch (error) {
      errors.push((error as Error).message);
    }
    labelTier = explicitLabelTier ?? declaredTier;
  } else {
    errors.push(...evidenceContract.errors);
  }

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
  const swarmMetadata = {
    swarmsDeclared: [],
    swarmMode: ('evidence' in evidenceContract ? evidenceContract.evidence.mode : null),
    swarmTeamId: null,
    hasSwarmModeField: false,
    hasSwarmTeamField: false,
    swarmWarnings: [] as string[]
  };
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
  if (evidenceContract.exists && 'evidence' in evidenceContract) {
    const impliedMode = resolveImpliedExecutionMode(teamResolution.executionModesTouched);
    errors.push(
      ...validateEvidenceAgainstComputedState({
        evidence: evidenceContract.evidence,
        changedFiles,
        labelTier: explicitLabelTier,
        impliedMode
      })
    );
  }
  if (modePolicy.status === 'failed' && modePolicy.message) {
    errors.push(modePolicy.message);
  }
  const railBindingResult = resolveRailBindingDiagnostics(entityTelemetryResult.telemetry.entitiesTouched);
  const nextActions = buildNextActions(
    declaredTier,
    impliedTier,
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
      'If you updated governance/evidence.json or labels after a failed run, push a new commit to refresh the PR payload before re-running.'
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
    podsTouched: podOwnership.podsTouched,
    podByProject: podOwnership.podByProject,
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
