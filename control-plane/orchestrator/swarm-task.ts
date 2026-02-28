import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import { canonicalStringify } from '../finance/determinism.ts';
import { generateBody } from '../cli/governance-generate.ts';
import { normalizeBody } from '../cli/governance-normalize.ts';
import type { GovernanceReport } from '../governance/diagnostics.ts';
import { normalizeCi } from './ci/normalize.ts';
import { evaluateRetryEligibilityForNormalizedCi } from './ci/retry-eligibility.ts';
import type { NormalizedCiSummary, RawCheck } from './ci/types.ts';
import { buildOrchestratorExecutionReportV1 } from './report/build-report.ts';
import type { OrchestratorExecutionReportV1 } from './report/types.ts';
import {
  type RetryAppliedFix,
  type RetryState,
  type RetriableErrorCode,
  buildDeterministicFixPlan,
  createInitialRetryState,
  parseGovernanceReport,
  toGovernanceRetryContext,
  withFinalStatus,
  withRetryAttempt
} from './retry/retry-engine.ts';

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
  retryState: RetryState;
  governanceReport: (GovernanceReport & { retryContext?: ReturnType<typeof toGovernanceRetryContext> }) | null;
  executionReportPath: string;
  executionReport: OrchestratorExecutionReportV1;
};

type SwarmTaskDependencies = {
  runCommand: (command: string, args: string[], allowFailure?: boolean) => CommandResult;
};

const TEMP_PR_BODY_PATH = 'control-plane/orchestrator/.swarm-task-pr-body.tmp.md';

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

function resolveTier(report: GovernanceReport): 0 | 1 | 2 | 3 {
  const candidate = report.declaredTier ?? report.labelTier ?? report.impliedTier;
  if (candidate === 0 || candidate === 1 || candidate === 2 || candidate === 3) {
    return candidate;
  }
  throw new Error('Unable to resolve governance tier for deterministic retry patch.');
}

function readPrBody(prNumber: number, deps: SwarmTaskDependencies): string {
  const result = deps.runCommand('gh', ['pr', 'view', String(prNumber), '--json', 'body', '--jq', '.body']);
  return result.stdout.replace(/\n$/, '');
}

function readPrChangedFiles(prNumber: number, deps: SwarmTaskDependencies): string[] {
  const result = deps.runCommand('gh', ['pr', 'diff', String(prNumber), '--name-only']);
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
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

function updatePrBody(prNumber: number, body: string, deps: SwarmTaskDependencies): void {
  fs.writeFileSync(TEMP_PR_BODY_PATH, `${body}\n`, 'utf8');
  try {
    deps.runCommand('gh', ['pr', 'edit', String(prNumber), '--body-file', TEMP_PR_BODY_PATH]);
  } finally {
    fs.rmSync(TEMP_PR_BODY_PATH, { force: true });
  }
}

function addLabel(prNumber: number, label: string, deps: SwarmTaskDependencies): void {
  deps.runCommand('gh', ['pr', 'edit', String(prNumber), '--add-label', label]);
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

function applyRetryFix(params: {
  prNumber: number;
  triggerErrorCode: RetriableErrorCode;
  governanceReport: GovernanceReport;
  deps: SwarmTaskDependencies;
}): { applied: boolean; retryAppliedFix: RetryAppliedFix | null } {
  const plan = buildDeterministicFixPlan(params.triggerErrorCode);

  if (plan.fix === 'ADD_LABEL') {
    const tier = resolveTier(params.governanceReport);
    addLabel(params.prNumber, `tier-${tier}`, params.deps);
    return { applied: true, retryAppliedFix: 'ADD_LABEL' };
  }

  if (plan.fix === 'ADD_APPROVAL_LABEL') {
    addLabel(params.prNumber, 'tier-3-approved', params.deps);
    return { applied: true, retryAppliedFix: 'ADD_APPROVAL_LABEL' };
  }

  if (plan.fix === 'REGENERATE_BODY') {
    const tier = resolveTier(params.governanceReport);
    const changedPaths = readPrChangedFiles(params.prNumber, params.deps);
    const generated = generateBody({ tier, changedPaths });
    const normalized = normalizeBody(generated).normalized;
    updatePrBody(params.prNumber, normalized, params.deps);
    return { applied: true, retryAppliedFix: 'REGENERATE_BODY' };
  }

  if (plan.fix === 'NORMALIZE_BODY') {
    const current = readPrBody(params.prNumber, params.deps);
    const normalized = normalizeBody(current).normalized;
    updatePrBody(params.prNumber, normalized, params.deps);
    return { applied: true, retryAppliedFix: 'NORMALIZE_BODY' };
  }

  return { applied: false, retryAppliedFix: null };
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
  retryState: RetryState;
  ciSummary: NormalizedCiSummary;
  eligibility: RetryEligibilityDecision;
  governanceReport: GovernanceReport | null;
  retryAppliedFix: RetryAppliedFix | null;
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
      finalStatus: toReportFinalStatus(params.retryState.finalStatus)
    }
  });

  const executionReportPath = writeExecutionReport(executionReport, params.prNumber);

  return {
    executionMode: params.executionMode,
    prNumber: params.prNumber,
    ciStatusInitial: params.ciStatusInitial,
    ciStatusFinal: params.ciStatusFinal,
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
  deps?: Partial<SwarmTaskDependencies>;
}): Promise<SwarmTaskResult> {
  const deps: SwarmTaskDependencies = {
    runCommand,
    ...params.deps
  };

  const prCreate = deps.runCommand('npm', ['run', 'pr:create'], false);
  const prNumber = parsePrNumberFromPrCreateOutput(`${prCreate.stdout}\n${prCreate.stderr}`);

  let retryState = createInitialRetryState();
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
      retryState,
      ciSummary: initialCiSummary,
      eligibility: initialEligibility,
      governanceReport,
      retryAppliedFix: null,
      headSha
    });
  }

  if (!initialEligibility.eligible || !initialEligibility.triggerErrorCode || !governanceReport) {
    if (initialCiStatus === 'failed') {
      retryState = withFinalStatus(retryState, 'failed');
    }

    return buildResult({
      executionMode: params.executionMode,
      prNumber,
      ciStatusInitial: initialCiStatus,
      ciStatusFinal: initialCiStatus,
      retryState,
      ciSummary: initialCiSummary,
      eligibility: initialEligibility,
      governanceReport,
      retryAppliedFix: null,
      headSha
    });
  }

  const fix = applyRetryFix({
    prNumber,
    triggerErrorCode: initialEligibility.triggerErrorCode,
    governanceReport,
    deps
  });

  if (!fix.applied || !fix.retryAppliedFix) {
    retryState = withFinalStatus(retryState, 'failed');
    return buildResult({
      executionMode: params.executionMode,
      prNumber,
      ciStatusInitial: initialCiStatus,
      ciStatusFinal: 'failed',
      retryState,
      ciSummary: initialCiSummary,
      eligibility: initialEligibility,
      governanceReport,
      retryAppliedFix: null,
      headSha
    });
  }

  const finalCiSummary = evaluateCiSummary(prNumber, deps);
  const finalCiStatus = finalCiSummary.ciStatus;

  retryState = withRetryAttempt(retryState, {
    triggerErrorCode: initialEligibility.triggerErrorCode,
    finalStatus: finalCiStatus === 'passed' ? 'passed' : 'failed_after_retry'
  });

  governanceReport = readGovernanceReportForPr(prNumber, deps) ?? governanceReport;

  const finalEligibility = evaluateRetryEligibilityForNormalizedCi({
    executionMode: params.executionMode,
    ci: finalCiSummary,
    retryState
  });

  return buildResult({
    executionMode: params.executionMode,
    prNumber,
    ciStatusInitial: initialCiStatus,
    ciStatusFinal: finalCiStatus,
    retryState,
    ciSummary: finalCiSummary,
    eligibility: finalEligibility,
    governanceReport,
    retryAppliedFix: fix.retryAppliedFix,
    headSha
  });
}
