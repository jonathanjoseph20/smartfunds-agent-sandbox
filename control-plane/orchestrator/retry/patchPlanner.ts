import { canonicalStringify, sha256 } from '../../finance/determinism.ts';
import type { PatchOp, PatchPlan } from './patchTypes.ts';

type GovernanceClassification = 'governance' | 'non_governance' | 'unknown';

export type BuildPatchPlanParams = {
  retryAttempt: number;
  governanceErrorCode: string | null;
  governanceClassification?: GovernanceClassification | null;
  requiredTier?: number | null;
  requiredTierLabel?: string | null;
};

function normalizeCode(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function stableSortLabels(labels: string[]): string[] {
  return Array.from(new Set(labels)).sort((left, right) => left.localeCompare(right));
}

function opSortRank(op: PatchOp): number {
  if (op.op === 'add_label') {
    return 0;
  }
  if (op.op === 'set_pr_body') {
    return 1;
  }
  if (op.op === 'refresh_payload') {
    return 2;
  }
  return 3;
}

export function stablePlanOps(ops: PatchOp[]): PatchOp[] {
  const labelOps = stableSortLabels(ops.filter((entry): entry is Extract<PatchOp, { op: 'add_label' }> => entry.op === 'add_label')
    .map((entry) => entry.label))
    .map((label) => ({ op: 'add_label', label }) satisfies PatchOp);

  const setBodyOp = ops.find((entry): entry is Extract<PatchOp, { op: 'set_pr_body' }> => entry.op === 'set_pr_body');
  const refreshOp = ops.find((entry): entry is Extract<PatchOp, { op: 'refresh_payload' }> => entry.op === 'refresh_payload');
  const noopOp = ops.find((entry): entry is Extract<PatchOp, { op: 'noop' }> => entry.op === 'noop');

  const ordered: PatchOp[] = [...labelOps];
  if (setBodyOp) {
    ordered.push(setBodyOp);
  }
  if (refreshOp) {
    ordered.push(refreshOp);
  }
  if (noopOp && ordered.length === 0) {
    ordered.push(noopOp);
  }

  return ordered.sort((left, right) => {
    const rankCompare = opSortRank(left) - opSortRank(right);
    if (rankCompare !== 0) {
      return rankCompare;
    }
    if (left.op === 'add_label' && right.op === 'add_label') {
      return left.label.localeCompare(right.label);
    }
    return 0;
  });
}

function noopPlan(governanceErrorCode: string, retryAttempt: number, reason: string): PatchPlan {
  const ops: PatchOp[] = [{ op: 'noop', reason }];
  return {
    version: 'v1',
    patchId: createPatchId(governanceErrorCode, retryAttempt, ops),
    governanceErrorCode,
    retryAttempt,
    ops
  };
}

export function buildPatchPlan(params: BuildPatchPlanParams): PatchPlan {
  const code = normalizeCode(params.governanceErrorCode);
  const governanceCode = code ?? 'N/A';

  if (params.retryAttempt >= 1) {
    return noopPlan(governanceCode, params.retryAttempt, 'max_retries_exhausted');
  }

  if (params.governanceClassification && params.governanceClassification !== 'governance') {
    return noopPlan(governanceCode, params.retryAttempt, 'non_governance_failure');
  }

   if (!code) {
    return noopPlan(governanceCode, params.retryAttempt, 'missing_governance_error_code');
  }

    if (code === 'MISSING_TIER_LABEL') {
    const tierLabel =
      params.requiredTierLabel ??
      (typeof params.requiredTier === 'number' ? `tier-${params.requiredTier}` : 'tier-3');

    const ops: PatchOp[] = [
      { op: 'add_label', label: tierLabel }
    ];

    return {
      version: 'v1',
      patchId: createPatchId(code, params.retryAttempt, ops),
      governanceErrorCode: code,
      retryAttempt: params.retryAttempt,
      ops: stablePlanOps(ops)
    };
  }
  return noopPlan(code, params.retryAttempt, `legacy_governance_error_not_actionable:${code}`);
}

function createPatchId(governanceErrorCode: string, retryAttempt: number, ops: PatchOp[]): string {
  const payload = canonicalStringify({
    version: 'v1',
    governanceErrorCode,
    retryAttempt,
    ops
  });
  return `patch-v1-${sha256(payload).slice(0, 16)}`;
}
