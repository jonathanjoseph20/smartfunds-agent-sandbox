import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import { canonicalStringify } from '../finance/determinism.ts';
import { generateBody } from '../cli/governance-generate.ts';
import { normalizeBody } from '../cli/governance-normalize.ts';
import type { GovernanceReport } from '../governance/diagnostics.ts';
import {
  type RetryAppliedFix,
  type RetryState,
  type RetriableErrorCode,
  buildDeterministicFixPlan,
  createInitialRetryState,
  evaluateRetryEligibility,
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

type CiStatus = 'passed' | 'failed' | 'pending';

type SwarmTaskResult = {
  executionMode: ExecutionMode;
  prNumber: number;
  ciStatusInitial: CiStatus;
  ciStatusFinal: CiStatus;
  retryState: RetryState;
  governanceReport: (GovernanceReport & { retryContext?: ReturnType<typeof toGovernanceRetryContext> }) | null;
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

function evaluateCiStatus(prNumber: number, deps: SwarmTaskDependencies): CiStatus {
  const result = deps.runCommand('gh', ['pr', 'view', String(prNumber), '--json', 'statusCheckRollup'], true);
  if (result.status !== 0) {
    return 'pending';
  }

  const parsed = JSON.parse(result.stdout) as {
    statusCheckRollup?: Array<{ conclusion?: string | null; state?: string | null }>;
  };
  const checks = parsed.statusCheckRollup ?? [];

  const conclusions = checks
    .map((check) => (check.conclusion ?? check.state ?? '').toUpperCase())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  if (conclusions.some((value) => ['FAILURE', 'FAILED', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED'].includes(value))) {
    return 'failed';
  }

  if (conclusions.length === 0 || conclusions.some((value) => ['PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED'].includes(value))) {
    return 'pending';
  }

  if (conclusions.every((value) => ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(value))) {
    return 'passed';
  }

  return 'failed';
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

  const initialCiStatus = evaluateCiStatus(prNumber, deps);
  let retryState = createInitialRetryState();
  let governanceReport = readGovernanceReportForPr(prNumber, deps);

  if (initialCiStatus === 'passed') {
    retryState = withFinalStatus(retryState, 'passed');
    return {
      executionMode: params.executionMode,
      prNumber,
      ciStatusInitial: initialCiStatus,
      ciStatusFinal: 'passed',
      retryState,
      governanceReport: withRetryContext(governanceReport, retryState, null)
    };
  }

  const eligibility = evaluateRetryEligibility({
    executionMode: params.executionMode,
    ciStatus: initialCiStatus === 'failed' ? 'failed' : 'passed',
    retryState,
    governanceReport
  });

  if (!eligibility.eligible || !eligibility.triggerErrorCode || !governanceReport) {
    if (params.executionMode === 'structured' && initialCiStatus === 'failed') {
      retryState = withFinalStatus(retryState, 'failed');
    } else if (initialCiStatus === 'failed') {
      retryState = withFinalStatus(retryState, 'failed');
    }

    return {
      executionMode: params.executionMode,
      prNumber,
      ciStatusInitial: initialCiStatus,
      ciStatusFinal: initialCiStatus,
      retryState,
      governanceReport: withRetryContext(governanceReport, retryState, null)
    };
  }

  const fix = applyRetryFix({
    prNumber,
    triggerErrorCode: eligibility.triggerErrorCode,
    governanceReport,
    deps
  });

  if (!fix.applied || !fix.retryAppliedFix) {
    retryState = withFinalStatus(retryState, 'failed');
    return {
      executionMode: params.executionMode,
      prNumber,
      ciStatusInitial: initialCiStatus,
      ciStatusFinal: 'failed',
      retryState,
      governanceReport: withRetryContext(governanceReport, retryState, null)
    };
  }

  const finalCiStatus = evaluateCiStatus(prNumber, deps);
  retryState = withRetryAttempt(retryState, {
    triggerErrorCode: eligibility.triggerErrorCode,
    finalStatus: finalCiStatus === 'passed' ? 'passed' : 'failed_after_retry'
  });

  governanceReport = readGovernanceReportForPr(prNumber, deps) ?? governanceReport;

  return {
    executionMode: params.executionMode,
    prNumber,
    ciStatusInitial: initialCiStatus,
    ciStatusFinal: finalCiStatus,
    retryState,
    governanceReport: withRetryContext(governanceReport, retryState, fix.retryAppliedFix)
  };
}
