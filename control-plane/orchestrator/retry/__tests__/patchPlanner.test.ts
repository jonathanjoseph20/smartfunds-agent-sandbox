import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../../finance/determinism.ts';
import { buildPatchPlan } from '../patchPlanner.ts';

describe('patchPlanner', () => {
  it('retryAttempt=1 returns noop max_retries_exhausted', () => {
    const plan = buildPatchPlan({
      retryAttempt: 1,
      governanceErrorCode: 'MISSING_TIER_LABEL',
      governanceClassification: 'governance',
      requiredTier: 3
    });

    expect(plan.ops).toEqual([{ op: 'noop', reason: 'max_retries_exhausted' }]);
  });

  it('legacy tier remediation codes are inert', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'MISSING_TIER_LABEL',
      governanceClassification: 'governance',
      requiredTier: 3
    });

    expect(plan.ops).toEqual([{ op: 'noop', reason: 'legacy_governance_error_not_actionable:MISSING_TIER_LABEL' }]);
  });

  it('legacy approval remediation codes are inert', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'MISSING_TIER_3_APPROVED',
      governanceClassification: 'governance'
    });

    expect(plan.ops).toEqual([{ op: 'noop', reason: 'legacy_governance_error_not_actionable:MISSING_TIER_3_APPROVED' }]);
  });

  it('legacy evidence remediation codes are inert', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'MISSING_EVIDENCE_BLOCK',
      governanceClassification: 'governance',
      requiredTier: 3
    });

    expect(plan.ops).toEqual([{ op: 'noop', reason: 'legacy_governance_error_not_actionable:MISSING_EVIDENCE_BLOCK' }]);
  });

  it('unknown code emits deterministic noop reason', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'SOME_NEW_ERROR',
      governanceClassification: 'governance',
      requiredTier: 3
    });

    expect(plan.ops).toEqual([{ op: 'noop', reason: 'legacy_governance_error_not_actionable:SOME_NEW_ERROR' }]);
  });

  it('label ops sorted, refresh last, no duplicates', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'MISSING_TIER_LABEL',
      governanceClassification: 'governance',
      requiredTierLabel: 'tier-2'
    });

    expect(plan.ops).toEqual([{ op: 'noop', reason: 'legacy_governance_error_not_actionable:MISSING_TIER_LABEL' }]);
    expect(new Set(plan.ops.map((entry) => canonicalStringify(entry))).size).toBe(plan.ops.length);
    expect(plan.ops[plan.ops.length - 1]).toEqual({ op: 'noop', reason: 'legacy_governance_error_not_actionable:MISSING_TIER_LABEL' });
  });

  it('planner output is deterministic for identical input', () => {
    const input = {
      retryAttempt: 0,
      governanceErrorCode: 'MISSING_EVIDENCE_FIELDS',
      governanceClassification: 'governance' as const,
      requiredTier: 3
    };
    const first = buildPatchPlan(input);
    const second = buildPatchPlan(input);

    expect(canonicalStringify(first)).toBe(canonicalStringify(second));
    expect(first.patchId).toBe(second.patchId);
    expect(typeof first.patchId).toBe('string');
  });

});
