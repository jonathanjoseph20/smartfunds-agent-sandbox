import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../../finance/determinism.ts';
import { buildCanonicalPrBody } from '../canonicalPrBody.ts';
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

  it('MISSING_TIER_LABEL with tier=3 emits label + refresh', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'MISSING_TIER_LABEL',
      governanceClassification: 'governance',
      requiredTier: 3
    });

    expect(plan.ops).toEqual([
      { op: 'add_label', label: 'tier-3' },
      { op: 'refresh_payload', method: 'empty_commit' }
    ]);
  });

  it('MISSING_TIER_LABEL with missing tier emits noop missing_required_tier', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'MISSING_TIER_LABEL',
      governanceClassification: 'governance'
    });

    expect(plan.ops).toEqual([{ op: 'noop', reason: 'missing_required_tier' }]);
  });

  it('MISSING_TIER_3_APPROVED tier=3 emits tier-3-approved + refresh', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'MISSING_TIER_3_APPROVED',
      governanceClassification: 'governance',
      requiredTier: 3
    });

    expect(plan.ops).toEqual([
      { op: 'add_label', label: 'tier-3-approved' },
      { op: 'refresh_payload', method: 'empty_commit' }
    ]);
  });

  it('MISSING_EVIDENCE_BLOCK emits canonical body + refresh', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'MISSING_EVIDENCE_BLOCK',
      governanceClassification: 'governance',
      requiredTier: 3
    });

    expect(plan.ops[0].op).toBe('set_pr_body');
    if (plan.ops[0].op !== 'set_pr_body') {
      throw new Error('expected set_pr_body op');
    }
    const lines = plan.ops[0].body.split('\n');
    expect(lines).toContain('tier-3');
    expect(lines).toContain('```evidence');
    expect(lines).toContain('```');
    expect(plan.ops[1]).toEqual({ op: 'refresh_payload', method: 'empty_commit' });
  });

  it('unknown code emits deterministic noop reason', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'SOME_NEW_ERROR',
      governanceClassification: 'governance',
      requiredTier: 3
    });

    expect(plan.ops).toEqual([{ op: 'noop', reason: 'unhandled_error_code:SOME_NEW_ERROR' }]);
  });

  it('label ops sorted, refresh last, no duplicates', () => {
    const plan = buildPatchPlan({
      retryAttempt: 0,
      governanceErrorCode: 'MISSING_TIER_LABEL',
      governanceClassification: 'governance',
      requiredTierLabel: 'tier-2'
    });

    expect(plan.ops).toEqual([
      { op: 'add_label', label: 'tier-2' },
      { op: 'refresh_payload', method: 'empty_commit' }
    ]);
    expect(new Set(plan.ops.map((entry) => canonicalStringify(entry))).size).toBe(plan.ops.length);
    expect(plan.ops[plan.ops.length - 1]).toEqual({ op: 'refresh_payload', method: 'empty_commit' });
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
  });

  it('canonical body builder is deterministic', () => {
    const first = buildCanonicalPrBody({ tierLabel: 'tier-3' });
    const second = buildCanonicalPrBody({ tierLabel: 'tier-3' });
    expect(first).toBe(second);
  });
});
