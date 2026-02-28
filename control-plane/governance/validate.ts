import fs from 'node:fs';
import path from 'node:path';

import {
  buildBootstrapActions,
  buildEvidenceBlockAction,
  buildGovernanceReport,
  buildStalePayloadActions,
  getMissingTierLabels,
  loadRiskContract,
  resolveDeclaredTier,
  selectPrimaryAction,
  shouldWarnStalePayload,
  validatePrData,
  type GovernanceError,
  type GovernanceReport,
  type PullRequestData,
  type RiskContract
} from './diagnostics.ts';
import { evaluateModePolicy } from './mode-policy.ts';
import { resolveRailBindingDiagnostics } from './rail-binding.ts';
import { scanCommentsForEvidence } from '../pr-body/comment-scan.ts';
import { fetchPrComments } from '../pr-body/gh-fetch.ts';
import { resolveEntityTelemetry } from '../studio/entity-registry.ts';
import { loadProjectsFromDir, loadTeamsFromDir, type Project, type Team } from '../studio/registry.ts';
import { buildOwnershipErrors, resolveOwnership, type OwnershipResult } from '../studio/ownership.ts';
import { parseSwarmEvidenceMetadata } from '../swarm/parser.ts';
import { evaluateSwarmPolicy } from '../swarm/validator.ts';
import { loadSwarmsFromDir } from '../swarms/registry.ts';
import { resolveSwarmsForProjects } from '../swarms/resolution.ts';
import { evaluateSwarmOrchestration } from '../swarms/orchestration.ts';
import type { SwarmDefinition } from '../swarms/types.ts';
import { resolveTeamsForChangedFiles } from '../teams/team-resolver.ts';
import { buildIsolationEnforcement } from '../governance-check.ts';

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
  commentFetcher?: (args: { prNumber: number; repository: string }) => Promise<Array<{ id: number; body: string }>>;
};

type FetchedPrData = {
  prData: PullRequestData;
  prNumber: number;
  repository: string;
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

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

function renderSummary(result: GovernanceReport, status: 'PASS' | 'FAIL', primaryAction: string | null): string {
  const lines: string[] = [];
  lines.push(`Result: ${status}`);
  lines.push(`Declared Tier: ${result.declaredTier ?? 'n/a'}`);
  lines.push(`Label Tier: ${result.labelTier ?? 'n/a'}`);
  lines.push(`Implied Tier: ${result.impliedTier ?? 'n/a'}`);
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
  };
  const prNumber = event.pull_request?.number;

  if (!prNumber) {
    throw new Error('This validator must run on pull_request events.');
  }

  const [owner, repo] = repository.split('/');
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

    if (files.length === 0) {
      break;
    }

    changedFiles.push(...files.map((file) => file.filename));
    if (files.length < 100) {
      break;
    }
    page += 1;
  }

  return {
    prData: {
      body: pr.body ?? '',
      labels: pr.labels.map((label) => label.name),
      changedFiles
    },
    prNumber,
    repository
  };
}

function shouldScanForCommentEvidence(validationResult: ReturnType<typeof validatePrData>): boolean {
  const hasMissingTier = validationResult.tierBodyLabel === undefined;
  const hasMissingEvidence = validationResult.missingEvidenceFields.length > 0;
  const hasUnsupportedEvidence = validationResult.errors.some((error) => error.includes('unsupported field'));

  return hasMissingTier || hasMissingEvidence || hasUnsupportedEvidence;
}

function buildSealCommand(prNumber: number | null, tier: number): string {
  const prValue = prNumber === null ? '<n>' : String(prNumber);
  return `npm run pr:seal -- --pr ${prValue} --tier ${tier} --evidence-file <path>`;
}

async function buildReport(
  prData: PullRequestData,
  contract: RiskContract,
  context: {
    repo?: string;
    prNumber: number | null;
    repository: string | null;
    bodySource: 'gh' | 'stub';
    labelSource: 'gh' | 'stub';
  },
  commentFetcher: (args: { prNumber: number; repository: string }) => Promise<Array<{ id: number; body: string }>>
): Promise<{ report: GovernanceReport; errors: string[] }> {
  const result = validatePrData(prData, contract);
  let ownershipResult: OwnershipResult;
  let projects: Project[] = [];
  let teams: Team[] = [];
  let swarms: SwarmDefinition[] = [];
  const errors: string[] = [...result.errors];
  const sealWarnings: string[] = [];
  const additionalErrors: GovernanceError[] = [];

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
  const swarmMetadata = parseSwarmEvidenceMetadata(prData.body);
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
  if (modePolicy.status === 'failed' && modePolicy.message) {
    errors.push(modePolicy.message);
  }
  const railBindingResult = resolveRailBindingDiagnostics(entityTelemetryResult.telemetry.entitiesTouched);
  const nextActions = buildNextActions(result, prData, context.repo);
  nextActions.push(...modePolicy.nextActions);
  nextActions.push(...ownershipResult.nextActions);
  nextActions.push(...entityTelemetryResult.nextActions);
  nextActions.push(...railBindingResult.nextActions);
  nextActions.push(...isolation.nextActions);

  const warnings = [
    ...buildWarnings(result.errors),
    ...swarmPolicy.swarmWarnings,
    ...entityTelemetryResult.warnings,
    ...railBindingResult.warnings
  ];

  let commentEvidenceDetected = false;
  let commentEvidenceCount = 0;
  let commentSource: 'gh' | 'none' | 'unknown' = 'none';
  if (
    shouldScanForCommentEvidence(result) &&
    context.prNumber !== null &&
    context.repository
  ) {
    try {
      const comments = await commentFetcher({
        prNumber: context.prNumber,
        repository: context.repository
      });
      const scan = scanCommentsForEvidence(comments);
      commentEvidenceDetected = scan.detected;
      commentEvidenceCount = scan.count;
      commentSource = 'gh';

      if (scan.detected) {
        const suggestedTier = labelTier ?? declaredTier ?? impliedTier;
        const sealCommand = buildSealCommand(context.prNumber, suggestedTier);
        const message =
          'Governance payload detected in PR comments, but PR body is invalid. Move payload to PR description.';
        const actionable = `EVIDENCE_IN_COMMENT_NOT_BODY: ${message}`;

        errors.push(actionable);
        nextActions.push(`Run: ${sealCommand}`);
        sealWarnings.push(`Comment evidence detected in ${scan.count} comment(s): [${scan.commentIds.join(', ')}]`);

        additionalErrors.push({
          code: 'EVIDENCE_IN_COMMENT_NOT_BODY',
          severity: 'error',
          retryable: true,
          message,
          suggestedFix: {
            action: 'run_pr_seal',
            details: `Run: ${sealCommand}`
          },
          sourceFields: ['metadataSource.commentSource', 'commentEvidenceDetected', 'commentEvidenceCount']
        });
      }
    } catch (error) {
      commentSource = 'unknown';
      warnings.push(`Unable to scan PR comments for governance evidence: ${(error as Error).message}`);
    }
  }

  if (warnings.length > 0) {
    nextActions.push(...buildStalePayloadActions());
  }

  const swarmResolution = resolveSwarmsForProjects(ownershipResult.projectsTouched, swarms);
  const swarmsTouched = sortedUnique([
    ...(Array.isArray(swarmResolution.swarmsTouched) ? swarmResolution.swarmsTouched : []),
    ...swarmPolicy.swarmsTouched
  ]);
  const orchestrationResult = evaluateSwarmOrchestration({
    swarmsTouched,
    swarms,
    registryPath: 'control-plane/swarms/orchestration.json'
  });
  if (orchestrationResult.status !== 'ok') {
    errors.push(...orchestrationResult.violations);
  }

  return {
    report: buildGovernanceReport({
      declaredTier,
      impliedTier,
      labelTier,
      missingLabels,
      missingEvidenceFields: result.missingEvidenceFields,
      requiredChecks: result.requiredChecks,
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
      additionalErrors,
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

export async function runGovernanceValidation(options: GovernanceValidationOptions = {}): Promise<GovernanceValidationResult> {
  const contractPath = options.contractPath ?? path.resolve('control-plane/risk-contract.json');
  const contract = loadRiskContract(contractPath);
  const defaultCommentFetcher = async (args: { prNumber: number; repository: string }) => fetchPrComments(args.prNumber, args.repository);
  const commentFetcher = options.commentFetcher ?? defaultCommentFetcher;

  let prData: PullRequestData;
  let prNumber: number | null;
  let repository: string | null;
  let bodySource: 'gh' | 'stub';
  let labelSource: 'gh' | 'stub';

  if (options.prData) {
    prData = options.prData;
    prNumber = options.prNumber ?? null;
    repository = options.repository ?? process.env.GITHUB_REPOSITORY ?? null;
    bodySource = 'stub';
    labelSource = 'stub';
  } else {
    const fetched = await fetchPrDataFromGitHub(options);
    prData = fetched.prData;
    prNumber = fetched.prNumber;
    repository = fetched.repository;
    bodySource = 'gh';
    labelSource = 'gh';
  }

  const repo = options.repo ?? repository ?? undefined;
  const { report, errors } = await buildReport(
    prData,
    contract,
    { repo, prNumber, repository, bodySource, labelSource },
    commentFetcher
  );
  const ok = errors.length === 0 && report.modeEnforcementStatus === 'ok';
  const status: 'PASS' | 'FAIL' = ok ? 'PASS' : 'FAIL';
  const primaryAction = selectPrimaryAction(report.nextActions);
  const summaryText = renderSummary(report, status, primaryAction);

  return {
    ok,
    status,
    report,
    errors,
    primaryAction,
    summaryText
  };
}
