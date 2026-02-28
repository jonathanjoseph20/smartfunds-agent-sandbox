import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

import { buildPreflightReport } from '../../cli/governance-preflight.ts';
import { resolveLocalMetadata } from '../metadata-resolution.ts';
import { runGovernanceValidation } from '../validate.ts';
import { applyMissingEvidenceRiskTier, applyMissingTierDeclaration } from './patchers.ts';

const RETRY_COMMIT_MESSAGE = 'fix(governance): apply deterministic retry patch';

export const RETRYABLE_ERROR_CODES = [
  'MISSING_TIER_DECLARATION',
  'MISSING_EVIDENCE_FIELD',
  'MISSING_REQUIRED_LABEL'
] as const;

type RetryableErrorCode = (typeof RETRYABLE_ERROR_CODES)[number];
type Severity = 'error' | 'warning';

type RetryCandidate = {
  code: RetryableErrorCode;
  severity: Severity;
  message: string;
};

type MetadataSource = {
  bodySource: 'ci' | 'cli' | 'stub' | 'template';
  bodyPath: string | null;
  labelSource: 'ci' | 'cli' | 'stub';
  labelsPath: string | null;
};

type LocalValidationResult = {
  ok: boolean;
  report: Awaited<ReturnType<typeof runGovernanceValidation>>['report'];
  errors: string[];
  body: string;
  metadataSource: MetadataSource;
};

export type AutonomousRetryOptions = {
  pr?: number;
  maxRetries?: number;
  dryRun?: boolean;
  bodyFile?: string;
  labelsFile?: string;
  changedFiles?: string[];
  commitAndPush?: boolean;
};

export type AutonomousRetryResult = {
  exitCode: 0 | 1;
  report: Awaited<ReturnType<typeof runGovernanceValidation>>['report'];
};

function runCommand(command: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) {
    throw new Error(`Failed to execute ${command}: ${result.error.message}`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

function getChangedFilesFromGit(): string[] {
  const result = runCommand('git', ['diff', '--name-only', 'main...HEAD']);
  if (result.status !== 0) {
    throw new Error('Unable to determine changed files via git diff main...HEAD.');
  }
  if (!result.stdout.trim()) {
    return [];
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function normalizeCandidates(result: { report: LocalValidationResult['report']; errors: string[] }): RetryCandidate[] {
  const candidates: RetryCandidate[] = [];

  const hasMissingTier = result.errors.some((error) => error.includes('Missing unfenced PR body tier declaration'));
  if (hasMissingTier) {
    candidates.push({
      code: 'MISSING_TIER_DECLARATION',
      severity: 'error',
      message: 'Missing unfenced PR body tier declaration.'
    });
  }

  const missingEvidence = result.report.errors.find(
    (error) => error.code === 'MISSING_EVIDENCE_BLOCK' || error.code === 'MISSING_EVIDENCE_FIELDS'
  );
  const missingRiskTier = result.report.missingEvidenceFields.includes('Risk Tier');
  if (missingEvidence && missingRiskTier) {
    candidates.push({
      code: 'MISSING_EVIDENCE_FIELD',
      severity: missingEvidence.severity,
      message: missingEvidence.message
    });
  }

  const missingLabel = result.report.errors.find(
    (error) => error.code === 'MISSING_LABEL' || error.code === 'MISSING_TIER_LABEL'
  );
  if (missingLabel) {
    candidates.push({
      code: 'MISSING_REQUIRED_LABEL',
      severity: missingLabel.severity,
      message: missingLabel.message
    });
  }

  const unique = new Map<string, RetryCandidate>();
  for (const candidate of candidates) {
    unique.set(`${candidate.code}|${candidate.severity}|${candidate.message}`, candidate);
  }

  const rank = (severity: Severity): number => (severity === 'error' ? 1 : 0);
  return Array.from(unique.values()).sort((left, right) => {
    const severityCompare = rank(right.severity) - rank(left.severity);
    if (severityCompare !== 0) {
      return severityCompare;
    }
    const codeCompare = left.code.localeCompare(right.code);
    if (codeCompare !== 0) {
      return codeCompare;
    }
    return left.message.localeCompare(right.message);
  });
}

function resolveTier(report: { declaredTier: number | null; impliedTier: number | null; labelTier: number | null }): 0 | 1 | 2 | 3 | null {
  const candidate = report.declaredTier ?? report.labelTier ?? report.impliedTier;
  if (candidate === 0 || candidate === 1 || candidate === 2 || candidate === 3) {
    return candidate;
  }
  return null;
}

function withRetryTrace<T extends {
  executionContext: { context: 'local' | 'ci'; executionMode: 'structured' | 'autonomous' | 'unknown'; retryEnabled: boolean };
  retryTrace: {
    attempted: boolean;
    retryCount: 0 | 1;
    initialStatus: 'passed' | 'failed';
    finalStatus: 'passed' | 'failed';
    triggerErrorCode: string | null;
    retryable: boolean;
    patchApplied: string | null;
  };
}>(
  report: T,
  retryTrace: {
    attempted: boolean;
    retryCount: 0 | 1;
    initialStatus: 'passed' | 'failed';
    finalStatus: 'passed' | 'failed';
    triggerErrorCode: string | null;
    retryable: boolean;
    patchApplied: string | null;
  }
): T {
  return {
    ...report,
    executionContext: {
      ...report.executionContext,
      executionMode: 'autonomous',
      retryEnabled: true
    },
    retryTrace
  };
}

function runLocalValidation(options: AutonomousRetryOptions): LocalValidationResult {
  const resolved = resolveLocalMetadata({
    bodyFile: options.bodyFile,
    labelsFile: options.labelsFile
  });
  const changedFiles = options.changedFiles ?? getChangedFilesFromGit();
  const result = buildPreflightReport(resolved.body, changedFiles, resolved.labels, {}, resolved.metadataSource);

  return {
    ok: result.ok,
    report: result.report,
    errors: result.errors,
    body: resolved.body,
    metadataSource: {
      ...resolved.metadataSource
    }
  };
}

function writeBody(path: string, body: string): void {
  fs.writeFileSync(path, `${body}\n`);
}

function commitAndPushLocalChanges(bodyPath: string): void {
  const add = runCommand('git', ['add', bodyPath]);
  if (add.status !== 0) {
    throw new Error('Unable to stage deterministic retry patch.');
  }
  const commit = runCommand('git', ['commit', '-m', RETRY_COMMIT_MESSAGE]);
  if (commit.status !== 0) {
    throw new Error('Unable to create deterministic retry patch commit.');
  }
  const push = runCommand('git', ['push']);
  if (push.status !== 0) {
    throw new Error('Unable to push deterministic retry patch commit.');
  }
}

function applyPatchForCandidate(body: string, code: RetryableErrorCode, tier: 0 | 1 | 2 | 3): {
  nextBody: string;
  patchApplied: 'ADD_TIER_DECLARATION' | 'ADD_EVIDENCE_RISK_TIER' | null;
  retryable: boolean;
} {
  if (code === 'MISSING_TIER_DECLARATION') {
    const patched = applyMissingTierDeclaration(body);
    return {
      nextBody: patched.nextBody,
      patchApplied: patched.patchApplied,
      retryable: true
    };
  }

  if (code === 'MISSING_EVIDENCE_FIELD') {
    const patched = applyMissingEvidenceRiskTier(body, tier);
    return {
      nextBody: patched.nextBody,
      patchApplied: patched.patchApplied,
      retryable: true
    };
  }

  return {
    nextBody: body,
    patchApplied: null,
    retryable: false
  };
}

function getPrBody(pr: number): string {
  const result = runCommand('gh', ['pr', 'view', String(pr), '--json', 'body', '--jq', '.body']);
  if (result.status !== 0) {
    throw new Error(`Unable to fetch PR body for ${pr}.`);
  }
  return result.stdout.replace(/\n$/, '');
}

function getPrLabels(pr: number): string[] {
  const result = runCommand('gh', ['pr', 'view', String(pr), '--json', 'labels', '--jq', '.labels[].name']);
  if (result.status !== 0) {
    throw new Error(`Unable to fetch PR labels for ${pr}.`);
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function getPrChangedFiles(pr: number): string[] {
  const result = runCommand('gh', ['pr', 'diff', String(pr), '--name-only']);
  if (result.status !== 0) {
    throw new Error(`Unable to fetch changed files for PR ${pr}.`);
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function editPrBody(pr: number, body: string): void {
  const tempPath = 'control-plane/governance/.autonomous-retry-body.tmp.md';
  fs.writeFileSync(tempPath, `${body}\n`);
  const result = runCommand('gh', ['pr', 'edit', String(pr), '--body-file', tempPath]);
  fs.rmSync(tempPath, { force: true });
  if (result.status !== 0) {
    throw new Error(`Unable to update PR body for ${pr}.`);
  }
}

async function runCiValidation(pr: number, bodyOverride?: string): Promise<{
  ok: boolean;
  report: Awaited<ReturnType<typeof runGovernanceValidation>>['report'];
  errors: string[];
  body: string;
  labels: string[];
  changedFiles: string[];
}> {
  const body = bodyOverride ?? getPrBody(pr);
  const labels = getPrLabels(pr);
  const changedFiles = getPrChangedFiles(pr);
  const result = await runGovernanceValidation({
    prData: {
      body,
      labels,
      changedFiles
    }
  });
  const reportWithCiSource = {
    ...result.report,
    metadataSource: {
      bodySource: 'ci' as const,
      bodyPath: null,
      labelSource: 'ci' as const,
      labelsPath: null
    },
    executionContext: {
      ...result.report.executionContext,
      context: 'ci' as const
    }
  };
  return {
    ok: result.ok,
    report: reportWithCiSource,
    errors: result.errors,
    body,
    labels,
    changedFiles
  };
}

export async function runAutonomousRetry(options: AutonomousRetryOptions = {}): Promise<AutonomousRetryResult> {
  const maxRetries = options.maxRetries ?? 1;
  if (maxRetries > 1) {
    throw new Error('Invalid --max-retries value. Maximum supported retries is 1.');
  }
  const dryRun = options.dryRun ?? false;
  const commitAfterPatch = options.commitAndPush ?? false;

  if (options.pr !== undefined) {
    const initial = await runCiValidation(options.pr);
    const initialStatus: 'passed' | 'failed' = initial.ok ? 'passed' : 'failed';
    const candidates = normalizeCandidates({ report: initial.report, errors: initial.errors }).filter((candidate) =>
      RETRYABLE_ERROR_CODES.includes(candidate.code)
    );
    const selected = candidates[0] ?? null;

    if (initial.ok || maxRetries === 0 || !selected) {
      const report = withRetryTrace(initial.report, {
        attempted: false,
        retryCount: 0,
        initialStatus,
        finalStatus: initialStatus,
        triggerErrorCode: selected?.code ?? null,
        retryable: false,
        patchApplied: null
      });
      return {
        exitCode: report.retryTrace.finalStatus === 'passed' ? 0 : 1,
        report
      };
    }

    const tier = resolveTier(initial.report);
    if (tier === null) {
      const report = withRetryTrace(initial.report, {
        attempted: false,
        retryCount: 0,
        initialStatus,
        finalStatus: initialStatus,
        triggerErrorCode: selected.code,
        retryable: false,
        patchApplied: null
      });
      return {
        exitCode: report.retryTrace.finalStatus === 'passed' ? 0 : 1,
        report
      };
    }

    const patch = applyPatchForCandidate(initial.body, selected.code, tier);
    const isRetryable = patch.retryable && patch.patchApplied !== null;
    if (!isRetryable) {
      const report = withRetryTrace(initial.report, {
        attempted: false,
        retryCount: 0,
        initialStatus,
        finalStatus: initialStatus,
        triggerErrorCode: selected.code,
        retryable: patch.retryable,
        patchApplied: null
      });
      return {
        exitCode: report.retryTrace.finalStatus === 'passed' ? 0 : 1,
        report
      };
    }

    if (!dryRun) {
      editPrBody(options.pr, patch.nextBody);
    }

    const rerun = dryRun
      ? initial
      : await runCiValidation(options.pr, patch.nextBody);
    const finalStatus: 'passed' | 'failed' = rerun.ok ? 'passed' : 'failed';
    const report = withRetryTrace(rerun.report, {
      attempted: true,
      retryCount: 1,
      initialStatus,
      finalStatus,
      triggerErrorCode: selected.code,
      retryable: true,
      patchApplied: patch.patchApplied
    });
    return {
      exitCode: finalStatus === 'passed' ? 0 : 1,
      report
    };
  }

  const initial = runLocalValidation(options);
  const initialStatus: 'passed' | 'failed' = initial.ok ? 'passed' : 'failed';
  const candidates = normalizeCandidates({ report: initial.report, errors: initial.errors }).filter((candidate) =>
    RETRYABLE_ERROR_CODES.includes(candidate.code)
  );
  const selected = candidates[0] ?? null;

  if (initial.ok || maxRetries === 0 || !selected) {
    const report = withRetryTrace(initial.report, {
      attempted: false,
      retryCount: 0,
      initialStatus,
      finalStatus: initialStatus,
      triggerErrorCode: selected?.code ?? null,
      retryable: false,
      patchApplied: null
    });
    return {
      exitCode: report.retryTrace.finalStatus === 'passed' ? 0 : 1,
      report
    };
  }

  const tier = resolveTier(initial.report);
  if (tier === null) {
    const report = withRetryTrace(initial.report, {
      attempted: false,
      retryCount: 0,
      initialStatus,
      finalStatus: initialStatus,
      triggerErrorCode: selected.code,
      retryable: false,
      patchApplied: null
    });
    return {
      exitCode: report.retryTrace.finalStatus === 'passed' ? 0 : 1,
      report
    };
  }

  if (initial.metadataSource.bodySource === 'template' || !initial.metadataSource.bodyPath) {
    const report = withRetryTrace(initial.report, {
      attempted: false,
      retryCount: 0,
      initialStatus,
      finalStatus: initialStatus,
      triggerErrorCode: selected.code,
      retryable: false,
      patchApplied: null
    });
    return {
      exitCode: report.retryTrace.finalStatus === 'passed' ? 0 : 1,
      report
    };
  }

  const patch = applyPatchForCandidate(initial.body, selected.code, tier);
  const isRetryable = patch.retryable && patch.patchApplied !== null;
  if (!isRetryable) {
    const report = withRetryTrace(initial.report, {
      attempted: false,
      retryCount: 0,
      initialStatus,
      finalStatus: initialStatus,
      triggerErrorCode: selected.code,
      retryable: patch.retryable,
      patchApplied: null
    });
    return {
      exitCode: report.retryTrace.finalStatus === 'passed' ? 0 : 1,
      report
    };
  }

  if (!dryRun) {
    writeBody(initial.metadataSource.bodyPath, patch.nextBody);
    if (commitAfterPatch) {
      commitAndPushLocalChanges(initial.metadataSource.bodyPath);
    }
  }

  const rerun = dryRun
    ? initial
    : runLocalValidation({
        ...options,
        bodyFile: initial.metadataSource.bodyPath
      });
  const finalStatus: 'passed' | 'failed' = rerun.ok ? 'passed' : 'failed';
  const report = withRetryTrace(rerun.report, {
    attempted: true,
    retryCount: 1,
    initialStatus,
    finalStatus,
    triggerErrorCode: selected.code,
    retryable: true,
    patchApplied: patch.patchApplied
  });

  return {
    exitCode: finalStatus === 'passed' ? 0 : 1,
    report
  };
}
