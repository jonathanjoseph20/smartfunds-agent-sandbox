import fs from 'node:fs';
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
import {
  readEvidenceContract,
  resolveImpliedExecutionMode,
  validateEvidenceAgainstComputedState
} from './evidence-contract.ts';
import { evaluateModePolicy } from './mode-policy.ts';
import { resolveRailBindingDiagnostics } from './rail-binding.ts';
import { resolveEntityTelemetry } from '../studio/entity-registry.ts';
import { loadProjectsFromDir, loadTeamsFromDir, type Project, type Team } from '../studio/registry.ts';
import { buildOwnershipErrors, resolveOwnership, type OwnershipResult } from '../studio/ownership.ts';
import { evaluateSwarmPolicy } from '../swarm/validator.ts';
import { loadSwarmsFromDir } from '../swarms/registry.ts';
import { resolveSwarmsForProjects } from '../swarms/resolution.ts';
import { evaluateSwarmOrchestration } from '../swarms/orchestration.ts';
import type { SwarmDefinition } from '../swarms/types.ts';
import { resolveTeamsForChangedFiles } from '../teams/team-resolver.ts';
import { buildIsolationEnforcement } from '../governance-check.ts';
import { normalizeChangedFiles } from './changed-files.ts';
import { validatePrBody } from './pr-body.ts';
import { classifyPaths, type Tier as PolicyTier } from './tier-policy.ts';

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

type FetchedPrData = {
  prData: PullRequestData;
  prNumber: number;
  repository: string;
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
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
    actions.push(`Update governance/evidence.json tier to ${result.impliedTier} and align the tier label.`);
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
      'GitHub Actions re-runs can read stale governance metadata/labels. If you updated evidence.json or labels, push a new commit to refresh the payload.'
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

async function githubGet<T>(url: string, token: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
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

async function fetchPrDataFromGitHub(options: GovernanceValidationOptions): Promise<FetchedPrData> {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY;
  const eventPath = options.eventPath ?? process.env.GITHUB_EVENT_PATH;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!token || !repository || !eventPath) {
    throw new Error('Missing required env vars: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH.');
  }

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8')) as {
    pull_request?: { number?: number };
    number?: number;
  };

  // Support common payload shapes
  const prNumber = event.pull_request?.number ?? event.number;

  if (!prNumber) {
    throw new Error('This validator must run on pull_request events.');
  }

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY: "${repository}" (expected "owner/repo")`);
  }

  const pr = await githubGet<{ body: string | null; labels: Array<{ name: string }> }>(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    token,
    fetchImpl
  );

  const changedFiles: string[] = [];
  let page = 1;

  while (true) {
    const files = await githubGet<Array<{ filename: string }>>(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      token,
      fetchImpl
    );

    if (files.length === 0) break;

    changedFiles.push(...files.map((file) => file.filename));

    if (files.length < 100) break;
    page += 1;
  }

  // Deterministic + safe: always sort + de-dupe here.
  const stableFiles = sortedUnique(changedFiles);

  // Helpful CI debug signal (does not leak secrets)
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`[governance] fetched PR #${prNumber} changed files via PR API: ${stableFiles.length}`);
  }

  return {
    prData: {
      body: pr.body ?? '',
      labels: pr.labels.map((label) => label.name),
      changedFiles: stableFiles
    },
    prNumber,
    repository
  };
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

  try {
    validatePrBody(prData.body);
  } catch (error) {
    errors.push(formatGovernanceError('PR_BODY_CONTRACT_INVALID', (error as Error).message));
  }

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

  const evidenceContract = readEvidenceContract();
  let declaredTier: number | null = null;
  const requiredChecks: string[] = getRequiredChecksForTier(finalTier, contract);
  let missingLabels: string[] = [];
  let projects: Project[] = [];
  let teams: Team[] = [];
  let swarms: SwarmDefinition[] = [];
  let ownershipResult: OwnershipResult = {
    projectsTouched: [],
    teamsTouched: [],
    unownedFiles: [],
    ownershipStatus: 'ok',
    nextActions: []
  };

  if ('evidence' in evidenceContract) {
    declaredTier = evidenceContract.evidence.tier;
    if (labelTier !== null && labelTier !== declaredTier) {
      errors.push(
        `Risk tier mismatch: label tier is ${labelTier}; governance/evidence.json tier must be ${labelTier}.`
      );
    }

    missingLabels = [
      ...getMissingTierLabels(labelTier),
      ...(finalTier === 3 && !prData.labels.includes('tier-3-approved') ? ['tier-3-approved'] : [])
    ];

    if (finalTier === 3 && !prData.labels.includes('tier-3-approved')) {
      errors.push(
        'Tier 3 requires `tier-3-approved` label. Add it, and if CI still shows stale labels/evidence, push a new commit to refresh the PR payload.'
      );
    }
  } else {
    errors.push(...evidenceContract.errors);
  }

  if (finalTier >= 2) {
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
  }

  const entityTelemetryResult = resolveEntityTelemetry(ownershipResult.projectsTouched);

  const teamResolution = resolveTeamsForChangedFiles(prData.changedFiles);
  const swarmMetadata = {
    swarmsDeclared: [],
    swarmMode: 'evidence' in evidenceContract ? evidenceContract.evidence.mode : null,
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

  if ('evidence' in evidenceContract && finalTier >= 2) {
    const impliedMode = resolveImpliedExecutionMode(teamResolution.executionModesTouched);
    const evidenceErrors = validateEvidenceAgainstComputedState({
      evidence: evidenceContract.evidence,
      changedFiles: prData.changedFiles,
      labelTier: labelTier as Tier | null,
      impliedMode
    });

    for (const issue of evidenceErrors) {
      if (issue.startsWith('Affected paths mismatch:')) {
        if (finalTier === 3) {
          errors.push(issue);
        } else if (finalTier === 2) {
          warnings.push(`TIER2_AFFECTED_PATHS_WARNING: ${issue}`);
        }
      } else {
        errors.push(issue);
      }
    }
  }

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

  return {
    report: buildGovernanceReport({
      declaredTier,
      impliedTier,
      labelTier,
      missingLabels,
      missingEvidenceFields,
      requiredChecks,
      projectsTouched: Array.isArray(ownershipResult.projectsTouched) ? ownershipResult.projectsTouched : [],
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
      structuredPathsTouched: isolation.classification.structuredPathsTouched,
      autonomousPathsTouched: isolation.classification.autonomousPathsTouched,
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

  if (options.prData) {
    prData = options.prData;
    repository = options.repository ?? process.env.GITHUB_REPOSITORY ?? null;
    bodySource = 'stub';
    labelSource = 'stub';
  } else {
    const fetched = await fetchPrDataFromGitHub(options);
    prData = fetched.prData;
    repository = fetched.repository;
    bodySource = 'gh';
    labelSource = 'gh';
  }

  const repo = options.repo ?? repository ?? undefined;

  // Normalize exactly once, deterministically.
  prData = {
    ...prData,
    changedFiles: normalizeChangedFiles(sortedUnique(prData.changedFiles))
  };

  const { report, errors } = await buildReport(prData, contract, { repo, bodySource, labelSource, mode });

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