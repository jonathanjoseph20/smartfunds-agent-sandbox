import path from 'node:path';

import {
  buildBootstrapActions,
  buildGovernanceReport,
  buildStalePayloadActions,
  extractTierFromLabels,
  getMissingTierLabels,
  getRequiredChecksForTier,
  loadRiskContract,
  selectPrimaryAction,
  shouldWarnStalePayload,
  type Tier,
  type GovernanceReport,
  type PullRequestData,
  type RiskContract
} from './diagnostics.ts';
import { readChangeDeclaration } from './change-declaration.ts';
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
import { classifyPaths, type Tier as PolicyTier } from './tier-policy.ts';
import { resolvePullRequestMetadata } from './pr-files-api.ts';

type GovernanceValidationResult = {
  ok: boolean;
  status: 'PASS' | 'FAIL';
  report: GovernanceReport;
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
  mode?: 'lite' | 'full';
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

function formatGovernanceError(code: string, message: string): string {
  return `${code}: ${message}`;
}

function computeFinalTier(labelTier: Tier | null, impliedTier: PolicyTier): Tier {
  if (labelTier === null) {
    return impliedTier;
  }
  return Math.max(labelTier, impliedTier) as Tier;
}

function needsBootstrapAction(missingLabels: string[]): boolean {
  const required = new Set(['tier-0', 'tier-1', 'tier-2', 'tier-3', 'tier-3-approved', 'codex']);
  return missingLabels.some((label) => required.has(label));
}

function buildNextActions(
  result: {
    tierLabel: number | null;
    impliedTier: number;
    declaredTier: number | null;
  },
  pr: PullRequestData,
  repo?: string
): string[] {
  const actions: string[] = [];

  if (result.tierLabel === null) {
    actions.push('Add exactly one label: tier-0, tier-1, tier-2, tier-3.');
  }

  if (result.declaredTier !== null && result.declaredTier < result.impliedTier) {
    actions.push(`Update governance/change.json tier to ${result.impliedTier} and align the tier label.`);
  }

  if (result.tierLabel === 3 && !pr.labels.includes('tier-3-approved')) {
    actions.push('Add label: tier-3-approved.');
  }

  if (
    needsBootstrapAction(getMissingTierLabels(result.tierLabel as Tier | null)) ||
    (result.tierLabel === 3 && !pr.labels.includes('tier-3-approved'))
  ) {
    actions.push(...buildBootstrapActions(repo));
  }

  return actions;
}

function buildWarnings(errors: string[]): string[] {
  const warnings: string[] = [];
  if (shouldWarnStalePayload(errors)) {
    warnings.push(
      'GitHub Actions re-runs can read stale governance metadata/labels. If you updated labels or change.json, push a new commit to refresh the payload.'
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
  const finalTier = Math.max(result.labelTier ?? result.impliedTier ?? 0, result.impliedTier ?? 0);
  const lines: string[] = [];
  lines.push(`Result: ${status}`);
  lines.push(`Declared Tier: ${result.declaredTier ?? 'n/a'}`);
  lines.push(`Label Tier: ${result.labelTier ?? 'n/a'}`);
  lines.push(`Implied Tier: ${result.impliedTier ?? 'n/a'}`);
  lines.push(`Final Tier: ${finalTier}`);
  lines.push(`Changed Files: ${changedFileCount}`);
  lines.push(`Fix: ${primaryAction ?? 'None'}`);
  return lines.join('\n');
}

async function buildReport(
  prData: PullRequestData,
  contract: RiskContract,
  context: {
    repo?: string;
    bodySource: 'gh' | 'stub';
    labelSource: 'gh' | 'stub';
    mode: 'lite' | 'full';
  }
): Promise<{ report: GovernanceReport; errors: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sealWarnings: string[] = [];
  const missingEvidenceFields: string[] = [];

  let labelTier: Tier | null = null;
  try {
    labelTier = extractTierFromLabels(prData.labels) ?? null;
  } catch (error) {
    errors.push(formatGovernanceError('INVALID_TIER_LABEL', (error as Error).message));
  }
  if (labelTier === null) {
    errors.push(
      formatGovernanceError(
        'MISSING_TIER_LABEL',
        'Missing risk tier label. Add exactly one: tier-0, tier-1, tier-2, tier-3.'
      )
    );
  }

  const pathClassification = classifyPaths(prData.changedFiles);
  const impliedTier = pathClassification.impliedTier;
  const finalTier = computeFinalTier(labelTier, impliedTier);
  const restrictedHits = sortedUnique(pathClassification.restrictedHits);

  if (labelTier !== null && labelTier < impliedTier) {
    if (labelTier <= 1 && restrictedHits.length > 0) {
      const offending = restrictedHits.join(', ');
      errors.push(
        formatGovernanceError(
          'SPLIT_REQUIRED',
          `tier-${labelTier} PR cannot include restricted paths: ${offending}. Options: (A) remove restricted files from this PR (for example: git restore -- <paths>) and keep tier-${labelTier}; (B) split into a separate PR or intentionally relabel to tier-${impliedTier}.`
        )
      );
    } else {
      errors.push(
        formatGovernanceError(
          'TIER_LABEL_TOO_LOW',
          `Label tier-${labelTier} is below implied tier-${impliedTier}. Paths requiring higher tier: ${restrictedHits.join(', ') || 'n/a'}. Remove higher-risk paths or relabel intentionally.`
        )
      );
    }
  }

  // Lite mode: if implied/final tier >=2, only enforce "no silent escalation" errors and exit early.
  if (context.mode === 'lite' && finalTier >= 2) {
    const liteBlockingErrors = errors.filter(
      (entry) => entry.startsWith('SPLIT_REQUIRED:') || entry.startsWith('TIER_LABEL_TOO_LOW:')
    );
    const report = buildGovernanceReport({
      declaredTier: null,
      impliedTier,
      labelTier,
      missingLabels: [],
      missingEvidenceFields,
      requiredChecks: [],
      projectsTouched: [],
      teamsTouched: [],
      swarmsTouched: [],
      unownedFiles: [],
      ownershipStatus: 'ok',
      nextActions: [],
      warnings,
      executionModesTouched: [],
      swarmExecutionModesTouched: [],
      modeWarnings: [],
      unownedPaths: [],
      ambiguousPaths: [],
      metadataSource: {
        bodySource: context.bodySource,
        bodyPath: null,
        labelSource: context.labelSource,
        labelsPath: null,
        commentSource: 'none'
      },
      commentEvidenceDetected: false,
      commentEvidenceCount: 0,
      sealWarnings,
      executionContext: {
        context: 'ci',
        executionMode: 'unknown',
        retryEnabled: false
      },
      retryTrace: {
        attempted: false,
        retryCount: 0,
        initialStatus: liteBlockingErrors.length === 0 ? 'passed' : 'failed',
        finalStatus: liteBlockingErrors.length === 0 ? 'passed' : 'failed',
        triggerErrorCode: null,
        retryable: false,
        patchApplied: null
      }
    });

    return { report, errors: liteBlockingErrors };
  }

  // Lite mode: tier 0/1 => run only minimal checks and return.
  if (context.mode === 'lite' && finalTier <= 1) {
    const report = buildGovernanceReport({
      declaredTier: null,
      impliedTier,
      labelTier,
      missingLabels: [],
      missingEvidenceFields,
      requiredChecks: getRequiredChecksForTier(finalTier, contract),
      projectsTouched: [],
      teamsTouched: [],
      swarmsTouched: [],
      unownedFiles: [],
      ownershipStatus: 'ok',
      nextActions: [],
      warnings,
      executionModesTouched: [],
      swarmExecutionModesTouched: [],
      modeWarnings: [],
      unownedPaths: [],
      ambiguousPaths: [],
      metadataSource: {
        bodySource: context.bodySource,
        bodyPath: null,
        labelSource: context.labelSource,
        labelsPath: null,
        commentSource: 'none'
      },
      commentEvidenceDetected: false,
      commentEvidenceCount: 0,
      sealWarnings,
      executionContext: {
        context: 'ci',
        executionMode: 'unknown',
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

    return { report, errors };
  }

  // Full mode: tier 0/1 => skip heavy governance
  if (context.mode === 'full' && finalTier <= 1) {
    const report = buildGovernanceReport({
      declaredTier: null,
      impliedTier,
      labelTier,
      missingLabels: [],
      missingEvidenceFields,
      requiredChecks: [],
      projectsTouched: [],
      teamsTouched: [],
      swarmsTouched: [],
      unownedFiles: [],
      ownershipStatus: 'ok',
      nextActions: [],
      warnings: [...warnings, 'Full governance skipped: final tier is <= 1.'],
      executionModesTouched: [],
      swarmExecutionModesTouched: [],
      modeWarnings: [],
      unownedPaths: [],
      ambiguousPaths: [],
      metadataSource: {
        bodySource: context.bodySource,
        bodyPath: null,
        labelSource: context.labelSource,
        labelsPath: null,
        commentSource: 'none'
      },
      commentEvidenceDetected: false,
      commentEvidenceCount: 0,
      sealWarnings,
      executionContext: {
        context: 'ci',
        executionMode: 'unknown',
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
    });

    return { report, errors: [] };
  }

  const changeDeclaration = readChangeDeclaration();
  let declaredTier: number | null = null;
  const requiredChecks: string[] = getRequiredChecksForTier(finalTier, contract);
  let missingLabels: string[] = [];
  let ownershipProjects: Project[] = [];
  let ownershipTeams: Team[] = [];
  let swarmProjects: Project[] = [];
  let swarms: SwarmDefinition[] = [];
  let ownershipResult: OwnershipResult = {
    projectsTouched: [],
    teamsTouched: [],
    unownedFiles: [],
    ownershipStatus: 'ok',
    nextActions: [],
    ambiguousOwnership: [],
    unownedDetails: []
  };

  if (changeDeclaration.ok) {
    declaredTier = changeDeclaration.declaration.tier;
    if (labelTier !== null && labelTier !== declaredTier) {
      errors.push(
        `Risk tier mismatch: label tier-${labelTier} does not match governance/change.json tier ${declaredTier}. Update change.json or the label so they agree.`
      );
    }

    missingLabels = [
      ...getMissingTierLabels(labelTier),
      ...(finalTier === 3 && !prData.labels.includes('tier-3-approved') ? ['tier-3-approved'] : [])
    ];

    if (finalTier === 3 && !prData.labels.includes('tier-3-approved')) {
      errors.push(
        'Tier 3 requires `tier-3-approved` label. Add it and push a new commit if CI shows stale labels.'
      );
    }
  } else {
    for (const e of changeDeclaration.errors) {
      errors.push(e);
    }
  }

  if (finalTier >= 2) {
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
    ownershipResult = resolveOwnership({
      changedFiles: prData.changedFiles,
      projects: ownershipProjects,
      teams: ownershipTeams
    });

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
  }

  const entityTelemetryResult = resolveEntityTelemetryFromProjects(
    ownershipResult.projectsTouched,
    ownershipProjects
  );

  const teamResolution = resolveTeamsForChangedFiles(prData.changedFiles);
  const swarmMetadata = {
    swarmsDeclared: [],
    swarmMode: changeDeclaration.ok ? changeDeclaration.declaration.mode : null,
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
    executionMode: swarmMetadata.swarmMode ?? 'unknown'
  });
  errors.push(...isolation.errors);

  const modePolicy = evaluateModePolicy({
    executionModesTouched: teamResolution.executionModesTouched,
    declaredTier
  });

  if (finalTier >= 2 && modePolicy.status === 'failed' && modePolicy.message) {
    errors.push(modePolicy.message);
  }

  const railBindingResult = resolveRailBindingDiagnostics(entityTelemetryResult.telemetry.entitiesTouched);

  const nextActions = buildNextActions(
    {
      tierLabel: labelTier,
      impliedTier,
      declaredTier
    },
    prData,
    context.repo
  );

  if (finalTier >= 2) {
    nextActions.push(...modePolicy.nextActions);
    nextActions.push(...ownershipResult.nextActions);
    nextActions.push(...entityTelemetryResult.nextActions);
    nextActions.push(...railBindingResult.nextActions);
    nextActions.push(...isolation.nextActions);
  }

  const stalePayloadWarning = shouldWarnStalePayload(errors);
  warnings.push(...buildWarnings(errors));
  if (finalTier >= 2) {
    warnings.push(...swarmPolicy.swarmWarnings);
    warnings.push(...entityTelemetryResult.warnings);
    warnings.push(...railBindingResult.warnings);
  }

  const commentEvidenceDetected = false;
  const commentEvidenceCount = 0;
  const commentSource: 'gh' | 'none' | 'unknown' = 'none';

  if (stalePayloadWarning) {
    nextActions.push(...buildStalePayloadActions());
  }

  const swarmResolution =
    finalTier >= 2
      ? resolveSwarmsForProjects(ownershipResult.projectsTouched, swarms)
      : { swarmsTouched: [], swarmExecutionModesTouched: [] as string[] };

  const swarmsTouched = sortedUnique([
    ...(Array.isArray(swarmResolution.swarmsTouched) ? swarmResolution.swarmsTouched : []),
    ...swarmPolicy.swarmsTouched
  ]);

  const orchestrationResult =
    finalTier >= 2
      ? evaluateSwarmOrchestration({
          swarmsTouched,
          swarms,
          registryPath: 'control-plane/swarms/orchestration.json'
        })
      : {
          status: 'ok',
          violations: [],
          edges: [],
          topologicalOrder: [],
          phaseBySwarm: {}
        };

  if (finalTier >= 2 && orchestrationResult.status !== 'ok') {
    errors.push(...orchestrationResult.violations);
  }
  const podOwnership = buildPodOwnership(
    Array.isArray(ownershipResult.projectsTouched) ? ownershipResult.projectsTouched : [],
    ownershipProjects
  );

  return {
    report: buildGovernanceReport({
      declaredTier,
      impliedTier,
      labelTier,
      missingLabels,
      missingEvidenceFields,
      requiredChecks,
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
      warnings,
      executionModesTouched: teamResolution.executionModesTouched,
      swarmExecutionModesTouched: swarmResolution.swarmExecutionModesTouched,
      modeWarnings: teamResolution.modeWarnings,
      unownedPaths: teamResolution.unownedPaths,
      ambiguousPaths: teamResolution.ambiguousPaths,
      metadataSource: {
        bodySource: context.bodySource,
        bodyPath: null,
        labelSource: context.labelSource,
        labelsPath: null,
        commentSource
      },
      commentEvidenceDetected,
      commentEvidenceCount,
      sealWarnings,
      executionContext: {
        context: 'ci',
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

  // Normalize exactly once, deterministically.
  prData = {
    ...prData,
    changedFiles: normalizeChangedFiles(sortedUnique(prData.changedFiles))
  };

  const { report, errors } = await buildReport(prData, contract, { repo, bodySource, labelSource, mode });
  if (metadataWarnings.length > 0) {
    report.warnings = sortedUnique([...report.warnings, ...metadataWarnings]);
  }

  const ok = errors.length === 0 && report.modeEnforcementStatus === 'ok';
  const status: 'PASS' | 'FAIL' = ok ? 'PASS' : 'FAIL';
  const primaryAction = selectPrimaryAction(report.nextActions);
  const summaryText = renderSummary(report, status, primaryAction, prData.changedFiles.length);

  return {
    ok,
    status,
    report,
    errors,
    primaryAction,
    summaryText
  };
}
