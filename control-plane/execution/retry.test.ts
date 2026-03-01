import { describe, expect, it } from 'vitest';

import {
  assertRetryEligible,
  assertValidAttemptIndex,
  computeAttemptId,
  isRetryEligible,
  MAX_RETRY_ATTEMPTS
} from './retry.ts';
import type { ErrorClass } from './error-classification.ts';

const ELIGIBLE_CLASSES: ErrorClass[] = [
  'LINT_FAILURE',
  'TYPECHECK_FAILURE',
  'UNIT_TEST_FAILURE',
  'INTEGRATION_TEST_FAILURE'
];

const INELIGIBLE_CLASSES: ErrorClass[] = [
  'GOVERNANCE_ERROR',
  'EVIDENCE_SCHEMA_ERROR',
  'TIER_MISMATCH',
  'OWNERSHIP_VIOLATION',
  'SCHEMA_VALIDATION_FAILURE',
  'TRANSIENT_INFRA_ERROR',
  'UNKNOWN_FAILURE'
];

describe('retry', () => {
  it('enforces max retry attempts', () => {
    expect(MAX_RETRY_ATTEMPTS).toBe(1);
    expect(() => assertValidAttemptIndex(0)).not.toThrow();
    expect(() => assertValidAttemptIndex(1)).not.toThrow();
    expect(() => assertValidAttemptIndex(2)).toThrowError('Invalid attempt index: 2. Max allowed is 1.');
  });

  it('has allowlist-only retry eligibility matrix', () => {
    for (const errorClass of ELIGIBLE_CLASSES) {
      expect(isRetryEligible({ attemptIndex: 0, errorClass })).toBe(true);
      expect(() => assertRetryEligible({ attemptIndex: 0, errorClass })).not.toThrow();
    }

    for (const errorClass of INELIGIBLE_CLASSES) {
      expect(isRetryEligible({ attemptIndex: 0, errorClass })).toBe(false);
      expect(() => assertRetryEligible({ attemptIndex: 0, errorClass })).toThrowError(
        `Retry not eligible for attemptIndex=0 and errorClass=${errorClass}.`
      );
    }
  });

  it('never allows retry for attemptIndex >= 1', () => {
    for (const errorClass of ELIGIBLE_CLASSES) {
      expect(isRetryEligible({ attemptIndex: 1, errorClass })).toBe(false);
    }
  });

  it('derives deterministic attempt IDs', () => {
    const first = computeAttemptId('run-1', 0);
    const second = computeAttemptId('run-1', 0);
    expect(first).toBe(second);
  });
});
