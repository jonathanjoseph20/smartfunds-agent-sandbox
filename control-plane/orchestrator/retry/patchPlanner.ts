import { buildCanonicalPrBody } from './canonicalPrBody.ts';
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

function normalizeTierLabel(params: { requiredTier?: number | null; requiredTierLabel?: string | null }): string | null {
  if (params.requiredTierLabel) {
    const match = params.requiredTierLabel.trim().match(/^tier-([0-3])$/i);
    if (match) {
      return `tier-${match[1]}`;
    }
  }

  const tier = params.requiredTier;
  if (tier === 0 || tier === 1 || tier === 2 || tier === 3) {
    return `tier-${tier}`;
  }

  return null;
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

function tierFromLabel(tierLabel: string): number | null {
  const match = tierLabel.match(/^tier-([0-3])$/);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
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

  const tierLabel = normalizeTierLabel({
    requiredTier: params.requiredTier,
    requiredTierLabel: params.requiredTierLabel
  });
  const tier = tierLabel ? tierFromLabel(tierLabel) : null;

  const ops: PatchOp[] = [];

  if (code === 'MISSING_TIER_LABEL') {
    if (!tierLabel) {
      return noopPlan(code, params.retryAttempt, 'missing_required_tier');
    }
    ops.push({ op: 'add_label', label: tierLabel });
    ops.push({ op: 'refresh_payload', method: 'empty_commit' });
  } else if (code === 'MISSING_TIER_3_APPROVED' || code === 'MISSING_APPROVAL_LABEL') {
    if (tier !== 3) {
      return noopPlan(code, params.retryAttempt, 'missing_required_tier3');
    }
    ops.push({ op: 'add_label', label: 'tier-3-approved' });
    ops.push({ op: 'refresh_payload', method: 'empty_commit' });
  } else if (
    code === 'MISSING_EVIDENCE_BLOCK' ||
    code === 'MISSING_EVIDENCE_FIELDS' ||
    code === 'MISSING_EVIDENCE_FIELD' ||
    code === 'INVALID_BODY_FORMAT'
  ) {
    if (!tierLabel) {
      return noopPlan(code, params.retryAttempt, 'missing_required_tier');
    }
    ops.push({
      op: 'set_pr_body',
      body: buildCanonicalPrBody({
        tierLabel
      })
    });
    ops.push({ op: 'refresh_payload', method: 'empty_commit' });
  } else {
    return noopPlan(code, params.retryAttempt, `unhandled_error_code:${code}`);
  }

  return {
    version: 'v1',
    patchId: createPatchId(code, params.retryAttempt, stablePlanOps(ops)),
    governanceErrorCode: code,
    retryAttempt: params.retryAttempt,
    ops: stablePlanOps(ops)
  };
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
