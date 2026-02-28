import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import { canonicalStringify } from '../finance/determinism.ts';
import type { GovernanceReport } from '../governance/diagnostics.ts';
import { normalizeCi } from './ci/normalize.ts';
import {
  evaluateRetryEligibilityForNormalizedCi,
  type RetryEligibilityDecision
} from './ci/retry-eligibility.ts';
import type { NormalizedCiSummary, RawCheck } from './ci/types.ts';
import { buildOrchestratorExecutionReportV1 } from './report/build-report.ts';
import type { OrchestratorExecutionReportV1 } from './report/types.ts';
import { runRetryIntegration } from './retryIntegration.ts';
import {
  type RetryAppliedFix,
  type RetryState,
  createInitialRetryState,
  parseGovernanceReport,
  toGovernanceRetryContext,
  withFinalStatus
} from './retry/retry-engine.ts';
import type { PatchOp, PatchPlan } from './retry/patchTypes.ts';

type CommandResult = {
  status: number;
  stdout: string;
  stderr: string;
};

type ExecutionMode = 'structured' | 'autonomous';

type CiStatus = 'passed' | 'failed' | 'unknown';

type SwarmTaskResult = {
  executionMode: ExecutionMode;
  prNumber: number;
  ciStatusInitial: CiStatus;
  ciStatusFinal: CiStatus;
  RETRY_ACTIVATION_RESULT: {
    retryAttempted: boolean;
    retryEligible: boolean;
    retryReason: string;
    patchId: string | null;
  };
  retryState: RetryState;
  governanceReport: (GovernanceReport & { retryContext?: ReturnType<typeof toGovernanceRetryContext> }) | null;
  executionReportPath: string;
  executionReport: OrchestratorExecutionReportV1;
};

type SwarmTaskDependencies = {
  runCommand: (command: string, args: string[], allowFailure?: boolean) => CommandResult;
};

function runCommand(command: string, args: string[], allowFailure = false): CommandResult {
  try {
    const stdout = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return {
      status: 0,
      stdout: stdout ?? '',
      stderr: ''
    };
  } catch (error) {
    const execError = error as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    const stdout = typeof execError.stdout === 'string'
      ? execError.stdout
      : Buffer.isBuffer(execError.stdout)
        ? execError.stdout.toString('utf8')
        : '';
    const stderr = typeof execError.stderr === 'string'
      ? execError.stderr
      : Buffer.isBuffer(execError.stderr)
        ? execError.stderr.toString('utf8')
        : '';

    if (!allowFailure) {
      throw new Error(`Command failed: ${command} ${args.join(' ')}\n${stdout}${stderr}`.trim());
    }

    return {
      status: execError.status ?? 1,
      stdout,
      stderr
    };
  }
}

function parsePrNumberFromPrCreateOutput(output: string): number {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const explicit = lines
    .map((line) => line.match(/^PR number:\s*(\d+)$/i)?.[1])
    .find((value): value is string => typeof value === 'string');
  if (explicit) {
    const parsed = Number.parseInt(explicit, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const fallback = lines
    .map((line) => line.match(/\/pull\/(\d+)/)?.[1])
    .find((value): value is string => typeof value === 'string');
  if (fallback) {
    const parsed = Number.parseInt(fallback, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  throw new Error('Unable to parse PR number from pr:create output.');
}

function readPrHeadSha(prNumber: number, deps: SwarmTaskDependencies): string | null {
  const result = deps.runCommand('gh', ['pr', 'view', String(prNumber), '--json', 'headRefOid'], true);
  if (result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout) as { headRefOid?: string | null };
    return typeof parsed.headRefOid === 'string' && parsed.headRefOid.trim().length > 0
      ? parsed.headRefOid
      : null;
  } catch {
    return null;
  }
}

function parseRawChecksFromRollup(stdout: string): RawCheck[] {
  const parsed = JSON.parse(stdout) as {
    statusCheckRollup?: Array<{
      name?: string | null;
      context?: string | null;
      status?: string | null;
      state?: string | null;
      conclusion?: string | null;
      detailsUrl?: string | null;
      output?: {
        summary?: string | null;
        text?: string | null;
      } | null;
      checkRun?: {
        name?: string | null;
        conclusion?: string | null;
        status?: string | null;
        detailsUrl?: string | null;
        output?: {
          summary?: string | null;
          text?: string | null;
        } | null;
      } | null;
    }>;
  };

  const rollup = parsed.statusCheckRollup ?? [];
  return rollup.map((entry) => {
    const checkRun = entry.checkRun ?? null;
    return {
      name: entry.name ?? entry.context ?? checkRun?.name ?? null,
      status: entry.status ?? checkRun?.status ?? null,
      state: entry.state ?? null,
      conclusion: entry.conclusion ?? checkRun?.conclusion ?? null,
      detailsUrl: entry.detailsUrl ?? checkRun?.detailsUrl ?? null,
      output: {
        summary: entry.output?.summary ?? checkRun?.output?.summary ?? null,
        text: entry.output?.text ?? checkRun?.output?.text ?? null
      }
    };
  });
}

function evaluateCiSummary(prNumber: number, deps: SwarmTaskDependencies): NormalizedCiSummary {
  const result = deps.runCommand('gh', ['pr', 'view', String(prNumber), '--json', 'statusCheckRollup'], true);
  if (result.status !== 0) {
    return normalizeCi([]);
  }

  try {
    return normalizeCi(parseRawChecksFromRollup(result.stdout));
  } catch {
    return normalizeCi([]);
  }
}

function readPrBody(prNumber: number, deps: SwarmTaskDependencies): string {
  const result = deps.runCommand('gh', ['pr', 'view', String(prNumber), '--json', 'body'], true);
  if (result.status !== 0 || !result.stdout.trim()) {
    return '';
  }

  try {
    const parsed = JSON.parse(result.stdout) as { body?: string | null };
    return typeof parsed.body === 'string' ? parsed.body : '';
  } catch {
    return '';
  }
}

function readPrLabels(prNumber: number, deps: SwarmTaskDependencies): string[] {
  const result = deps.runCommand('gh', ['pr', 'view', String(prNumber), '--json', 'labels'], true);
  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout) as { labels?: Array<{ name?: string | null }> };
    const labels = (parsed.labels ?? [])
      .map((entry) => entry.name ?? null)
      .filter((label): label is string => typeof label === 'string' && label.trim().length > 0);
    return Array.from(new Set(labels)).sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function readGovernanceReportForPr(prNumber: number, deps: SwarmTaskDependencies): GovernanceReport | null {
  const result = deps.runCommand(
    'npm',
    ['run', 'governance:autonomous-retry', '--', '--pr', String(prNumber), '--max-retries', '1', '--dry-run'],
    true
  );

  const combined = `${result.stdout}\n${result.stderr}`;
  try {
    return parseGovernanceReport(combined);
  } catch {
    return null;
  }
}

function resolveTierLabel(report: GovernanceReport): string | null {
  const candidate = report.declaredTier ?? report.labelTier ?? report.impliedTier;
  if (candidate === 0 || candidate === 1 || candidate === 2 || candidate === 3) {
    return `tier-${candidate}`;
  }
  return null;
}

function toLegacyRetryAppliedFix(appliedOps: PatchOp[]): RetryAppliedFix | null {
  if (appliedOps.some((entry) => entry.op === 'add_label' && entry.label === 'tier-3-approved')) {
    return 'ADD_APPROVAL_LABEL';
  }
  if (appliedOps.some((entry) => entry.op === 'set_pr_body')) {
    return 'REGENERATE_BODY';
  }
  if (appliedOps.some((entry) => entry.op === 'add_label')) {
    return 'ADD_LABEL';
  }
  return null;
}

function withRetryContext(report: GovernanceReport | null, retryState: RetryState, retryAppliedFix: RetryAppliedFix | null):
  (GovernanceReport & { retryContext?: ReturnType<typeof toGovernanceRetryContext> }) | null {
  if (!report) {
    return null;
  }

  return {
    ...report,
    retryContext: toGovernanceRetryContext(retryState, retryAppliedFix)
  };
}

function toReportFinalStatus(status: RetryState['finalStatus']): 'passed' | 'failed' {
  return status === 'passed' ? 'passed' : 'failed';
}

function reportPathForPr(prNumber: number | null): string {
  if (prNumber === null) {
    return '.orchestrator/reports/no-pr/execution-report.v1.json';
  }
  return `.orchestrator/reports/pr-${prNumber}/execution-report.v1.json`;
}

function writeExecutionReport(report: OrchestratorExecutionReportV1, prNumber: number | null): string {
  const path = reportPathForPr(prNumber);
  const directory = path.slice(0, path.lastIndexOf('/'));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path, `${canonicalStringify(report)}\n`, 'utf8');
  return path;
}

function buildResult(params: {
  executionMode: ExecutionMode;
  prNumber: number;
  ciStatusInitial: CiStatus;
  ciStatusFinal: CiStatus;
  retryActivationResult: {
    retryAttempted: boolean;
    retryEligible: boolean;
    retryReason: string;
    patchId: string | null;
  };
  retryState: RetryState;
  ciSummary: NormalizedCiSummary;
  eligibility: RetryEligibilityDecision;
  governanceReport: GovernanceReport | null;
  retryAppliedFix: RetryAppliedFix | null;
  patchPlan: PatchPlan | null;
  patchOutcomeCode: 'applied' | 'noop' | 'failed';
  patchAppliedOps: PatchOp[];
  patchDryRun: boolean;
  patchCommands: string[];
  headSha: string | null;
}): SwarmTaskResult {
  const executionReport = buildOrchestratorExecutionReportV1({
    executionMode: params.executionMode,
    pr: {
      number: params.prNumber,
      headSha: params.headSha
    },
    ci: {
      normalized: params.ciSummary
    },
    retry: {
      retryCount: params.retryState.retryCount as 0 | 1,
      retryAttempt: params.retryState.retryCount as 0 | 1,
      eligible: params.eligibility.eligible,
      ineligibleReason: params.eligibility.ineligibleReason,
      trigger: {
        failingCheckName: params.eligibility.triggerCheckName,
        governanceErrorCode: params.eligibility.triggerGovernanceErrorCode
      },
      retryContext: {
        consumed: params.retryState.retryCount > 0 || params.retryState.retryAttempted,
        retriableErrorCode: params.eligibility.triggerErrorCode
      },
      action: {
        patchApplied: params.retryAppliedFix,
        promptAmendmentApplied: params.retryAppliedFix === 'REGENERATE_BODY' || params.retryAppliedFix === 'NORMALIZE_BODY'
      },
      patchPlan: params.patchPlan,
      patchOutcomeCode: params.patchOutcomeCode,
      patchAppliedOps: params.patchAppliedOps,
      patchDryRun: params.patchDryRun,
      patchCommands: params.patchCommands,
      finalStatus: toReportFinalStatus(params.retryState.finalStatus)
    }
  });

  const executionReportPath = writeExecutionReport(executionReport, params.prNumber);

  return {
    executionMode: params.executionMode,
    prNumber: params.prNumber,
    ciStatusInitial: params.ciStatusInitial,
    ciStatusFinal: params.ciStatusFinal,
    RETRY_ACTIVATION_RESULT: {
      retryAttempted: params.retryActivationResult.retryAttempted,
      retryEligible: params.retryActivationResult.retryEligible,
      retryReason: params.retryActivationResult.retryReason,
      patchId: params.retryActivationResult.patchId
    },
    retryState: params.retryState,
    governanceReport: withRetryContext(params.governanceReport, params.retryState, params.retryAppliedFix),
    executionReportPath,
    executionReport
  };
}

export function stableStringify(value: unknown): string {
  return canonicalStringify(value);
}

export async function spawnTask(params: {
  executionMode: ExecutionMode;
  dryRun?: boolean;
  deps?: Partial<SwarmTaskDependencies>;
}): Promise<SwarmTaskResult> {
  const deps: SwarmTaskDependencies = {
    runCommand,
    ...params.deps
  };

  const prCreate = deps.runCommand('npm', ['run', 'pr:create'], false);
  const prNumber = parsePrNumberFromPrCreateOutput(`${prCreate.stdout}\n${prCreate.stderr}`);

  let retryState = createInitialRetryState();
  const patchDryRun = params.dryRun === true;
  let patchPlan: PatchPlan | null = null;
  let patchOutcomeCode: 'applied' | 'noop' | 'failed' = 'noop';
  let patchAppliedOps: PatchOp[] = [];
  let patchCommands: string[] = [];
  let retryActivationResult: SwarmTaskResult['RETRY_ACTIVATION_RESULT'] = {
    retryAttempted: false,
    retryEligible: false,
    retryReason: 'ci_not_failed',
    patchId: null
  };

  const initialCiSummary = evaluateCiSummary(prNumber, deps);
  const initialCiStatus = initialCiSummary.ciStatus;

  let governanceReport = readGovernanceReportForPr(prNumber, deps);
  const headSha = readPrHeadSha(prNumber, deps);

  const initialEligibility = evaluateRetryEligibilityForNormalizedCi({
    executionMode: params.executionMode,
    ci: initialCiSummary,
    retryState
  });

  if (initialCiStatus === 'passed') {
    retryState = withFinalStatus(retryState, 'passed');
    return buildResult({
      executionMode: params.executionMode,
      prNumber,
      ciStatusInitial: initialCiStatus,
      ciStatusFinal: 'passed',
      retryActivationResult,
      retryState,
      ciSummary: initialCiSummary,
      eligibility: initialEligibility,
      governanceReport,
      retryAppliedFix: null,
      patchPlan,
      patchOutcomeCode,
      patchAppliedOps,
      patchDryRun,
      patchCommands,
      headSha
    });
  }

  if (initialCiStatus !== 'failed') {
    retryState = withFinalStatus(retryState, 'pending');
    retryActivationResult = {
      retryAttempted: false,
      retryEligible: false,
      retryReason: initialCiStatus === 'unknown' ? 'ci_unknown' : 'ci_not_failed',
      patchId: null
    };
    return buildResult({
      executionMode: params.executionMode,
      prNumber,
      ciStatusInitial: initialCiStatus,
      ciStatusFinal: initialCiStatus,
      retryActivationResult,
      retryState,
      ciSummary: initialCiSummary,
      eligibility: initialEligibility,
      governanceReport,
      retryAppliedFix: null,
      patchPlan,
      patchOutcomeCode,
      patchAppliedOps,
      patchDryRun,
      patchCommands,
      headSha
    });
  }

  const retryIntegration = await runRetryIntegration({
    executionMode: params.executionMode,
    ciResult: initialCiSummary,
    prNumber,
    currentPrBody: readPrBody(prNumber, deps),
    currentLabels: readPrLabels(prNumber, deps),
    requiredTier: governanceReport?.requiredMinimumTier ?? governanceReport?.declaredTier ?? governanceReport?.labelTier ?? governanceReport?.impliedTier,
    requiredTierLabel: governanceReport ? resolveTierLabel(governanceReport) : null,
    dryRun: patchDryRun,
    gh: async (args) => {
      const result = deps.runCommand('gh', args, true);
      return {
        code: result.status,
        stdout: result.stdout,
        stderr: result.stderr
      };
    },
    git: async (args) => {
      const result = deps.runCommand('git', args, true);
      return {
        code: result.status,
        stdout: result.stdout,
        stderr: result.stderr
      };
    }
  });

  retryActivationResult = {
    retryAttempted: retryIntegration.retryAttempted,
    retryEligible: retryIntegration.retryEligible,
    retryReason: retryIntegration.retryReason,
    patchId: retryIntegration.patchId
  };

  patchPlan = retryIntegration.patchPlan ?? null;
  patchAppliedOps = retryIntegration.patchAppliedOps ?? [];
  patchCommands = retryIntegration.patchCommands ?? [];
  patchOutcomeCode = retryIntegration.retryAttempted
    ? retryIntegration.error ? 'failed' : 'applied'
    : 'noop';

  if (retryIntegration.error) {
    retryState = withFinalStatus(retryState, 'failed');
    return buildResult({
      executionMode: params.executionMode,
      prNumber,
      ciStatusInitial: initialCiStatus,
      ciStatusFinal: 'failed',
      retryActivationResult,
      retryState,
      ciSummary: initialCiSummary,
      eligibility: initialEligibility,
      governanceReport,
      retryAppliedFix: toLegacyRetryAppliedFix(patchAppliedOps),
      patchPlan,
      patchOutcomeCode,
      patchAppliedOps,
      patchDryRun,
      patchCommands,
      headSha
    });
  }

  if (!retryIntegration.retryAttempted) {
    if (initialCiStatus === 'failed') {
      retryState = withFinalStatus(retryState, 'failed');
    }
    return buildResult({
      executionMode: params.executionMode,
      prNumber,
      ciStatusInitial: initialCiStatus,
      ciStatusFinal: initialCiStatus,
      retryActivationResult,
      retryState,
      ciSummary: initialCiSummary,
      eligibility: initialEligibility,
      governanceReport,
      retryAppliedFix: null,
      patchPlan,
      patchOutcomeCode,
      patchAppliedOps,
      patchDryRun,
      patchCommands,
      headSha
    });
  }

  const retryAppliedFix = toLegacyRetryAppliedFix(patchAppliedOps);
  retryState = {
    ...retryState,
    retryCount: 1,
    retryAttempted: true,
    triggerErrorCode: initialEligibility.triggerErrorCode,
    finalStatus: 'failed_after_retry'
  };

  return buildResult({
    executionMode: params.executionMode,
    prNumber,
    ciStatusInitial: initialCiStatus,
    ciStatusFinal: initialCiStatus,
    retryActivationResult,
    retryState,
    ciSummary: initialCiSummary,
    eligibility: {
      ...initialEligibility,
      eligible: retryIntegration.retryEligible,
      ineligibleReason: retryIntegration.retryEligible ? null : initialEligibility.ineligibleReason
    },
    governanceReport,
    retryAppliedFix,
    patchPlan,
    patchOutcomeCode,
    patchAppliedOps,
    patchDryRun,
    patchCommands,
    headSha
  });
}
