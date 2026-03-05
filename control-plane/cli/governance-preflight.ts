import fs from 'node:fs';
import path from 'node:path';

import {
  buildGovernanceReport,
  buildStalePayloadActions,
  extractTierFromLabels,
  getRequiredChecksForTier,
  inferImpliedTier,
  loadRiskContract,
  shouldWarnStalePayload,
  stringifyGovernanceReport,
  type GovernanceReport,
  type Tier
} from '../governance/diagnostics.ts';
import {
  readEvidenceContract,
  resolveImpliedExecutionMode,
  validateEvidenceAgainstComputedState
} from '../governance/evidence-contract.ts';
import { defaultGitExec, getChangedFilesFromMain } from '../governance/changed-files.ts';
import { resolveLocalMetadata } from '../governance/metadata-resolution.ts';
import { evaluateModePolicy } from '../governance/mode-policy.ts';
import { renderGovernanceFailureSummary } from '../governance/failure-output.ts';
import { resolveRailBindingDiagnostics } from '../governance/rail-binding.ts';
import { runGovernanceValidation } from '../governance/validate.ts';
import { resolveEntityTelemetry } from '../studio/entity-registry.ts';
import { enforceModeBoundary } from '../studio/mode-boundary.ts';
import { evaluateSwarmPolicy } from '../swarm/validator.ts';
import { loadOwnershipProjects, loadProjectsFromDir, loadTeamsFromDir, type Project, type Team } from '../studio/registry.ts';
import { buildOwnershipErrors, resolveOwnership, type OwnershipResult } from '../studio/ownership.ts';
import { loadSwarmsFromDir } from '../swarms/registry.ts';
import { resolveSwarmsForProjects } from '../swarms/resolution.ts';
import { evaluateSwarmOrchestration } from '../swarms/orchestration.ts';
import type { SwarmDefinition } from '../swarms/types.ts';
import { resolveTeamsForChangedFiles } from '../teams/team-resolver.ts';
import { buildIsolationEnforcement } from '../governance-check.ts';

type GitExec = (args: string[]) => string;

type FileStat = { mtimeMs: number };

type PreflightDependencies = {
  branchName?: string;
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

const METADATA_MARKER = '.governance-metadata-changed';

type ParsedArgs = {
  bodyFile?: string;
  labelsFile?: string;
  pr?: number;
};

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

function parseArgs(argv: string[]): ParsedArgs {
  let bodyFile: string | undefined;
  let labelsFile: string | undefined;
  let pr: number | undefined;

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
    if (arg === '--pr') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --pr.');
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('Invalid value for --pr. Use a positive integer.');
      }
      pr = parsed;
      index += 1;
      continue;
    }
    if (arg.startsWith('--pr=')) {
      const value = arg.slice('--pr='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('Invalid value for --pr. Use a positive integer.');
      }
      pr = parsed;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { bodyFile, labelsFile, pr };
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

function resolveOwnershipResult(
  changedFiles: string[],
  deps: Required<Pick<PreflightDependencies, 'loadProjects' | 'loadTeams' | 'resolveOwnership'>>,
  errors: string[]
): { ownershipResult: OwnershipResult; projects: Project[] } {
  let ownershipResult: OwnershipResult;
  let projects: Project[] = [];
  let teams: Team[] = [];

  try {
    projects = deps.loadProjects();
  } catch (error) {
    errors.push((error as Error).message);
    projects = [];
  }

  try {
    teams = deps.loadTeams(projects);
  } catch (error) {
    teams = [];
  }

  ownershipResult = deps.resolveOwnership({ changedFiles, projects, teams });
  errors.push(...buildOwnershipErrors(ownershipResult));
  return { ownershipResult, projects };
}

function buildNextActions(params: {
  declaredTier: Tier | null;
  impliedTier: Tier;
  tier3ApprovalRequired: boolean;
  tier3ApprovalSatisfied: boolean;
  ownershipActions: string[];
}): string[] {
  const actions: string[] = [];

  if (params.declaredTier !== null && params.declaredTier < params.impliedTier) {
    actions.push(`Update governance/evidence.json tier to ${params.impliedTier} and apply matching tier label.`);
  }

  if (params.tier3ApprovalRequired && !params.tier3ApprovalSatisfied) {
    actions.push('Add label: tier-3-approved.');
  }

  actions.push(...params.ownershipActions);
  return actions;
}

export function buildPreflightReport(
  _body: string,
  changedFiles: string[],
  labelNames: string[],
  deps: PreflightDependencies = {},
  metadata: {
    bodySource: 'cli' | 'stub' | 'template';
    bodyPath: string | null;
    labelSource: 'cli' | 'stub';
    labelsPath: string | null;
  } = {
    bodySource: 'stub',
    bodyPath: null,
    labelSource: 'stub',
    labelsPath: null
  }
): PreflightResult {
  const errors: string[] = [];
  const branchName = deps.branchName ?? 'main';
  const contract = loadRiskContract(path.resolve('control-plane/risk-contract.json'));
  const { impliedTier, escalationFiles } = inferImpliedTier(changedFiles, contract);
  const warnings: string[] = [];
  const evidenceContract = readEvidenceContract({
    readFile: deps.readFile,
    existsSync: deps.existsSync
  });
  const missingEvidenceFields: string[] = [];
  let declaredTier: Tier | null = null;
  let labelTier: Tier | null = null;
  let explicitLabelTier: Tier | null = null;

  if ('evidence' in evidenceContract) {
    const evidence = evidenceContract.evidence;
    declaredTier = evidence.tier;
    try {
      explicitLabelTier = extractTierFromLabels(labelNames) ?? null;
    } catch (error) {
      errors.push((error as Error).message);
    }
    labelTier = explicitLabelTier ?? declaredTier;
  } else {
    errors.push(...evidenceContract.errors);
  }

  if (labelTier !== null && labelTier < impliedTier) {
    errors.push(
      `Declared tier-${labelTier} is below implied tier-${impliedTier}. Escalating files: ${escalationFiles.join(', ')}.`
    );
  }

  const tier3ApprovalRequired = declaredTier === 3;
  const tier3ApprovalSatisfied = tier3ApprovalRequired
    ? labelNames.includes('tier-3-approved')
    : true;

  if (tier3ApprovalRequired && !tier3ApprovalSatisfied) {
    errors.push('Tier 3 requires `tier-3-approved` label.');
  }

  const requiredChecks = labelTier !== null ? getRequiredChecksForTier(labelTier, contract) : [];

  const ownershipResolver = deps.resolveOwnership ?? resolveOwnership;
  const ownershipData = resolveOwnershipResult(
    changedFiles,
    {
      loadProjects: deps.loadProjects ?? (() => loadOwnershipProjects()),
      loadTeams: deps.loadTeams ?? ((projects) => loadTeamsFromDir('control-plane/teams', projects)),
      resolveOwnership: ownershipResolver
    },
    errors
  );
  const ownershipResult = ownershipData.ownershipResult;
  const podOwnership = buildPodOwnership(ownershipResult.projectsTouched, ownershipData.projects);
  const entityTelemetryResult = resolveEntityTelemetry(ownershipResult.projectsTouched);
  let swarms: SwarmDefinition[] = [];
  try {
    const projects = loadProjectsFromDir('control-plane/projects');
    if (projects.length > 0) {
      swarms = loadSwarmsFromDir('control-plane/swarms', projects);
    }
  } catch (error) {
    errors.push((error as Error).message);
    swarms = [];
  }

  const missingLabels = tier3ApprovalRequired && !tier3ApprovalSatisfied ? ['tier-3-approved'] : [];
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

  if ('evidence' in evidenceContract) {
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

  const enforceModePolicy = modePolicy.violation !== 'mixed_execution_modes';
  if (modePolicy.status === 'failed' && modePolicy.message && enforceModePolicy) {
    errors.push(modePolicy.message);
  }
  const railBindingResult = resolveRailBindingDiagnostics(entityTelemetryResult.telemetry.entitiesTouched);
  const stalePayloadWarning = shouldWarnStalePayload(errors);
  if (stalePayloadWarning) {
    warnings.push('GitHub Actions re-runs can read stale governance metadata/labels. If you updated evidence.json or labels, push a new commit to refresh the payload.');
  }

  const nextActions = buildNextActions({
    declaredTier,
    impliedTier,
    tier3ApprovalRequired,
    tier3ApprovalSatisfied,
    ownershipActions: ownershipResult.nextActions
  });
  const modeBoundary = enforceModeBoundary(
    teamResolution.executionModesTouched,
    teamResolution.teamsTouched,
    changedFiles
  );
  nextActions.push(...(modeBoundary.nextActions ?? []));
  nextActions.push(...modePolicy.nextActions);
  nextActions.push(...entityTelemetryResult.nextActions);
  nextActions.push(...railBindingResult.nextActions);
  nextActions.push(...isolation.nextActions);

  if (stalePayloadWarning) {
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
    missingLabels,
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
    modeBoundaryStatus: modeBoundary.modeBoundaryStatus,
    conflictingTeams: modeBoundary.conflictingTeams ?? [],
    conflictingPaths: modeBoundary.conflictingPaths ?? [],
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
    metadataSource: metadata,
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
    ok:
      errors.length === 0 &&
      (report.modeEnforcementStatus === 'ok' || report.modeViolation === 'mixed_execution_modes'),
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
  lines.push(`Isolation Status: ${result.report.isolationStatus}`);
  lines.push(`Isolation Violations: ${result.report.isolationViolations.join(', ') || 'none'}`);
  lines.push(`Swarm Orchestration: ${result.report.swarmOrchestrationStatus}`);
  lines.push(`Swarm Orchestration Topo: ${result.report.swarmTopologicalOrder.join(', ') || 'none'}`);
  lines.push(
    `Swarm Orchestration Edges: ${
      result.report.swarmDependencyEdges.map((edge) => `${edge.from}->${edge.to}`).join(', ') || 'none'
    }`
  );
  lines.push(`Swarm Orchestration Violations: ${result.report.swarmOrchestrationViolations.join(', ') || 'none'}`);
  lines.push(`Mode Warnings: ${result.report.modeWarnings.join(', ') || 'none'}`);
  lines.push(
    `Mode Enforcement: ${result.report.modeEnforcementStatus}${result.report.modeViolation ? ` (${result.report.modeViolation})` : ''}`
  );
  if (result.warnings.length > 0) {
    lines.push(`Warnings: ${result.warnings.join(' | ')}`);
  }
  if (result.report.requiredMinimumTier !== null) {
    lines.push(`Mode Required Minimum Tier: ${result.report.requiredMinimumTier}`);
  }
  lines.push(`Ownership Status: ${result.report.ownershipStatus}`);

  if (result.errors.some((error) => error === 'Missing governance/evidence.json')) {
    lines.push('Evidence: missing governance/evidence.json');
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
  const args = parseArgs(process.argv.slice(2));
  const gitExec = defaultGitExec;
  const readFile = (filePath: string) => fs.readFileSync(filePath, 'utf8');
  const existsSync = (filePath: string) => fs.existsSync(filePath);
  const changedFiles = getChangedFilesFromMain(gitExec);

  if (changedFiles.length === 0) {
    console.log('GOVERNANCE STATUS: PASS');
    console.log('Reason: No changed files detected against main.');
    console.log('Suggested Action: Continue with local development.');
    return;
  }

  const resolvedMetadata = resolveLocalMetadata({
    bodyFile: args.bodyFile,
    labelsFile: args.labelsFile,
    readFile,
    existsSync
  });

  const result = await runGovernanceValidation({
    mode: 'full',
    prData: {
      body: resolvedMetadata.body,
      labels: resolvedMetadata.labels,
      changedFiles
    },
    ...(args.pr !== undefined ? { prNumber: args.pr } : {})
  });

  if (!result.ok) {
    console.error('GOVERNANCE STATUS: FAIL');
    console.error(`Reason: ${result.errors[0] ?? 'Governance validation failed.'}`);
    console.error(`Suggested Action: ${result.primaryAction ?? 'Address governance violations and rerun preflight.'}`);
    console.error('');
    console.error(
      renderGovernanceFailureSummary({
        report: result.report,
        errors: result.errors,
        primaryAction: result.primaryAction
      })
    );
    console.error('');
    console.error('Technical Metadata:');
    console.error('GOVERNANCE_REPORT_JSON_START');
    console.error(stringifyGovernanceReport(result.report));
    console.error('GOVERNANCE_REPORT_JSON_END');
    process.exit(1);
  }

  console.log('GOVERNANCE STATUS: PASS');
  console.log('Reason: Full governance validation passed.');
  console.log('Suggested Action: Proceed with commit/push.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
