import path from 'node:path';

import {
  buildGovernanceReport,
  selectPrimaryAction,
  shouldWarnStalePayload,
  type GovernanceReport,
  type PullRequestData,
  type RiskContract,
  loadRiskContract
} from './diagnostics.ts';
import { evaluateModePolicy } from './mode-policy.ts';
import { resolveRailBindingDiagnostics } from './rail-binding.ts';
import { resolveEntityTelemetryFromProjects } from '../studio/entity-registry.ts';
import { loadOwnershipProjects, loadProjectsFromDir, loadTeamsFromDir, type Project, type Team } from '../studio/registry.ts';
import { buildOwnershipErrors, resolveOwnership, type OwnershipResult } from '../studio/ownership.ts';
import { evaluateSwarmPolicy } from '../swarm/validator.ts';
import { loadSwarmsFromDir } from '../swarms/registry.ts';
import { resolveSwarmsForProjects } from '../swarms/resolution.ts';
import { evaluateSwarmOrchestration } from '../swarms/orchestration.ts';
import type { SwarmDefinition } from '../swarms/types.ts';
import { resolveTeamsForChangedFiles } from '../teams/team-resolver.ts';
import { buildIsolationEnforcement } from '../governance-check.ts';
import { normalizeChangedFiles } from './changed-files.ts';
import { resolvePullRequestMetadata } from './pr-files-api.ts';
import { routePrGovernanceProfile, type PrProfileRoutingResult } from '../policy/pr-profile-routing.ts';

type GovernanceValidationResult = {
  ok: boolean;
  status: 'PASS' | 'FAIL';
  report: GovernanceReport;
  routing: PrProfileRoutingResult;
  errors: string[];
  primaryAction: string | null;
  summaryText: string;
};

type GovernanceValidationOptions = {
  prData?: PullRequestData;
  prNumber?: number;
  repo?: string;
  contractPath?: string;
  token?: string;
  eventPath?: string;
  repository?: string;
  fetchImpl?: typeof fetch;
  mode?: 'route' | 'lite' | 'full';
};

const BUILD_REQUIRED_CHECKS = ['lint', 'policy_validation', 'scope_enforcement', 'tests'] as const;
const CORE_REQUIRED_CHECKS = ['lint', 'policy_validation', 'scope_enforcement', 'tests', 'core_policy_validation'] as const;

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

function buildWarnings(errors: string[]): string[] {
  const warnings: string[] = [];
  if (shouldWarnStalePayload(errors)) {
    warnings.push(
      'GitHub Actions re-runs can read stale governance metadata. If you updated labels or change.json, push a new commit to refresh the payload.'
    );
  }
  return warnings;
}

function renderSummary(
  result: GovernanceReport,
  status: 'PASS' | 'FAIL',
  primaryAction: string | null,
  changedFileCount: number
): string {
  const lines: string[] = [];
  lines.push(`Result: ${status}`);
  lines.push(`Requested Profile: ${result.requestedProfile}`);
  lines.push(`Required Profile: ${result.requiredProfile}`);
  lines.push(`Final Profile: ${result.finalProfile}`);
  lines.push(`Routing Source: ${result.routingSource}`);
  lines.push(`Matched Scopes: ${result.matchedScopes.join(', ') || 'none'}`);
  lines.push(`Changed Files: ${changedFileCount}`);
  lines.push(`Fix: ${primaryAction ?? 'None'}`);
  return lines.join('\n');
}

function computeExecutionMode(executionModesTouched: string[]): 'structured' | 'autonomous' | 'unknown' {
  const uniqueModes = sortedUnique(executionModesTouched);
  if (uniqueModes.length !== 1) {
    return 'unknown';
  }
  return uniqueModes[0] === 'structured' ? 'structured' : uniqueModes[0] === 'autonomous' ? 'autonomous' : 'unknown';
}

function buildBaseReport(args: {
  context: { bodySource: 'gh' | 'stub'; labelSource: 'gh' | 'stub'; routing: PrProfileRoutingResult };
  requiredChecks: string[];
  warnings: string[];
  executionMode?: 'structured' | 'autonomous' | 'unknown';
}): Omit<Parameters<typeof buildGovernanceReport>[0], 'nextActions' | 'warnings' | 'requiredChecks'> & {
  requiredChecks: string[];
  warnings: string[];
  nextActions: string[];
} {
  return {
    requestedProfile: args.context.routing.requestedProfile,
    requiredProfile: args.context.routing.requiredProfile,
    finalProfile: args.context.routing.finalProfile,
    matchedScopes: args.context.routing.matchedScopes,
    routingSource: args.context.routing.source,
    declaredTier: null,
    impliedTier: null,
    labelTier: null,
    missingLabels: [],
    missingEvidenceFields: [],
    requiredChecks: args.requiredChecks,
    projectsTouched: [],
    teamsTouched: [],
    swarmsTouched: [],
    unownedFiles: [],
    ownershipStatus: 'ok',
    nextActions: [],
    warnings: args.warnings,
    executionModesTouched: [],
    swarmExecutionModesTouched: [],
    modeWarnings: [],
    unownedPaths: [],
    ambiguousPaths: [],
    metadataSource: {
      bodySource: args.context.bodySource,
      bodyPath: null,
      labelSource: args.context.labelSource,
      labelsPath: null,
      commentSource: 'none'
    },
    commentEvidenceDetected: false,
    commentEvidenceCount: 0,
    sealWarnings: [],
    executionContext: {
      context: 'ci',
      executionMode: args.executionMode ?? 'unknown',
      retryEnabled: false
    },
    retryTrace: {
      attempted: false,
      retryCount: 0,
      initialStatus: 'passed',
      finalStatus: 'passed',
      triggerErrorCode: null,
      retryable: false,
      patchApplied: null
    }
  };
}

async function buildReport(
  prData: PullRequestData,
  _contract: RiskContract,
  context: {
    repo?: string;
    bodySource: 'gh' | 'stub';
    labelSource: 'gh' | 'stub';
    mode: 'route' | 'lite' | 'full';
    routing: PrProfileRoutingResult;
  }
): Promise<{ report: GovernanceReport; errors: string[] }> {
  if (context.mode === 'route') {
    const routeErrors = [...context.routing.errors];
    const report = buildGovernanceReport({
      ...buildBaseReport({
        context,
        requiredChecks: [],
        warnings: []
      }),
      retryTrace: {
        attempted: false,
        retryCount: 0,
        initialStatus: routeErrors.length === 0 ? 'passed' : 'failed',
        finalStatus: routeErrors.length === 0 ? 'passed' : 'failed',
        triggerErrorCode: routeErrors[0] ?? null,
        retryable: false,
        patchApplied: null
      }
    });
    return { report, errors: routeErrors };
  }

  if (context.routing.finalProfile === 'lite') {
    return {
      report: buildGovernanceReport({
        ...buildBaseReport({
          context,
          requiredChecks: [],
          warnings: ['Governance enforcement skipped: profile route resolved to lite.']
        })
      }),
      errors: []
    };
  }

  if (context.routing.finalProfile === 'build') {
    const buildErrors = [...context.routing.errors];
    const report = buildGovernanceReport({
      ...buildBaseReport({
        context,
        requiredChecks: [...BUILD_REQUIRED_CHECKS],
        warnings: ['Build governance route active: profile-native policy/scope enforcement is active.']
      }),
      retryTrace: {
        attempted: false,
        retryCount: 0,
        initialStatus: buildErrors.length === 0 ? 'passed' : 'failed',
        finalStatus: buildErrors.length === 0 ? 'passed' : 'failed',
        triggerErrorCode: buildErrors[0] ?? null,
        retryable: false,
        patchApplied: null
      }
    });
    return { report, errors: buildErrors };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  let ownershipResult: OwnershipResult = {
    projectsTouched: [],
    teamsTouched: [],
    unownedFiles: [],
    ownershipStatus: 'ok',
    nextActions: [],
    ambiguousOwnership: [],
    unownedDetails: []
  };
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
  } catch {
    ownershipTeams = [];
  }

  ownershipResult = resolveOwnership({
    changedFiles: prData.changedFiles,
    projects: ownershipProjects,
    teams: ownershipTeams
  });

  const ownershipDiagnostics = buildOwnershipErrors(ownershipResult);
  if (ownershipDiagnostics.length > 0) {
    warnings.push(...ownershipDiagnostics.map((entry) => `Ownership diagnostic: ${entry}`));
  }

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

  const teamResolution = resolveTeamsForChangedFiles(prData.changedFiles);
  const executionMode = computeExecutionMode(teamResolution.executionModesTouched);
  const swarmMetadata = {
    swarmsDeclared: [],
    swarmMode: null,
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
    branchName: process.env.GITHUB_HEAD_REF ?? '',
    changedFiles: prData.changedFiles,
    executionMode
  });
  errors.push(...isolation.errors);

  const modePolicy = evaluateModePolicy({
    executionModesTouched: teamResolution.executionModesTouched
  });

  if (modePolicy.status === 'failed' && modePolicy.message) {
    errors.push(modePolicy.message);
  }

  const entityTelemetryResult = resolveEntityTelemetryFromProjects(
    ownershipResult.projectsTouched,
    ownershipProjects
  );
  const railBindingResult = resolveRailBindingDiagnostics(entityTelemetryResult.telemetry.entitiesTouched);

  const nextActions = [
    ...modePolicy.nextActions,
    ...ownershipResult.nextActions,
    ...entityTelemetryResult.nextActions,
    ...railBindingResult.nextActions,
    ...isolation.nextActions
  ];

  warnings.push(...buildWarnings(errors));
  warnings.push(...swarmPolicy.swarmWarnings);
  warnings.push(...entityTelemetryResult.warnings);
  warnings.push(...railBindingResult.warnings);

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

  const podOwnership = buildPodOwnership(
    Array.isArray(ownershipResult.projectsTouched) ? ownershipResult.projectsTouched : [],
    ownershipProjects
  );

  return {
    report: buildGovernanceReport({
      ...buildBaseReport({
        context,
        requiredChecks: [...CORE_REQUIRED_CHECKS],
        warnings,
        executionMode
      }),
      projectsTouched: Array.isArray(ownershipResult.projectsTouched) ? ownershipResult.projectsTouched : [],
      podsTouched: podOwnership.podsTouched,
      podByProject: podOwnership.podByProject,
      teamsTouched: Array.isArray(teamResolution.teamsTouched) ? teamResolution.teamsTouched : [],
      swarmsDeclared: swarmMetadata.swarmsDeclared,
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
      unownedFiles: Array.isArray(ownershipResult.unownedFiles) ? ownershipResult.unownedFiles : [],
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
      structuredPathsTouched: teamResolution.structuredPathsTouched,
      autonomousPathsTouched: teamResolution.autonomousPathsTouched,
      isolationStatus: isolation.classification.isolationStatus,
      isolationViolations: isolation.classification.isolationViolations,
      nextActions,
      executionModesTouched: teamResolution.executionModesTouched,
      swarmExecutionModesTouched: swarmResolution.swarmExecutionModesTouched,
      modeWarnings: teamResolution.modeWarnings,
      unownedPaths: teamResolution.unownedPaths,
      ambiguousPaths: teamResolution.ambiguousPaths,
      retryTrace: {
        attempted: false,
        retryCount: 0,
        initialStatus: errors.length === 0 ? 'passed' : 'failed',
        finalStatus: errors.length === 0 ? 'passed' : 'failed',
        triggerErrorCode: errors[0] ?? null,
        retryable: false,
        patchApplied: null
      }
    }),
    errors
  };
}

export async function runGovernanceValidation(
  options: GovernanceValidationOptions = {}
): Promise<GovernanceValidationResult> {
  const mode = options.mode ?? 'full';
  const contractPath = options.contractPath ?? path.resolve('control-plane/risk-contract.json');
  const contract = loadRiskContract(contractPath);

  let prData: PullRequestData;
  let repository: string | null;
  let bodySource: 'gh' | 'stub';
  let labelSource: 'gh' | 'stub';
  let metadataWarnings: string[] = [];

  if (options.prData) {
    prData = options.prData;
    repository = options.repository ?? process.env.GITHUB_REPOSITORY ?? null;
    bodySource = 'stub';
    labelSource = 'stub';
  } else {
    const metadata = await resolvePullRequestMetadata({
      token: options.token,
      repository: options.repository,
      eventPath: options.eventPath,
      pullNumber: options.prNumber,
      fetchImpl: options.fetchImpl,
      requireApi: false
    });

    prData = {
      body: metadata.body,
      labels: metadata.labels,
      changedFiles: metadata.changedFiles
    };
    repository = options.repository ?? process.env.GITHUB_REPOSITORY ?? null;
    bodySource = metadata.source === 'api' ? 'gh' : 'stub';
    labelSource = metadata.source === 'api' ? 'gh' : 'stub';
    metadataWarnings = metadata.warnings;
  }

  const repo = options.repo ?? repository ?? undefined;

  prData = {
    ...prData,
    changedFiles: normalizeChangedFiles(sortedUnique(prData.changedFiles))
  };

  const routing = routePrGovernanceProfile({
    prBody: prData.body,
    changedFiles: prData.changedFiles,
    repository: repo
  });

  const { report, errors } = await buildReport(prData, contract, {
    repo,
    bodySource,
    labelSource,
    mode,
    routing
  });
  if (metadataWarnings.length > 0) {
    report.warnings = sortedUnique([...report.warnings, ...metadataWarnings]);
  }

  const allErrors = sortedUnique([...errors, ...routing.errors]);
  const ok = allErrors.length === 0 && report.modeEnforcementStatus === 'ok';
  const status: 'PASS' | 'FAIL' = ok ? 'PASS' : 'FAIL';
  const primaryAction = selectPrimaryAction(report.nextActions);
  const summaryText = renderSummary(report, status, primaryAction, prData.changedFiles.length);

  return {
    ok,
    status,
    report,
    routing,
    errors: allErrors,
    primaryAction,
    summaryText
  };
}
