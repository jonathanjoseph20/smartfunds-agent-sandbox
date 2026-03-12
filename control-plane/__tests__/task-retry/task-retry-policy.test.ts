import { describe, expect, it } from 'vitest';

import {
  deriveDeterministicRetryDelay,
  evaluateTaskRetryEligibility,
} from '../../task-execution/task-retry-policy.ts';

describe('task retry policy', () => {
  it('T-MTE-RP1 computes deterministic delay models', () => {
    expect(deriveDeterministicRetryDelay({ retryDelayModel: 'immediate', baseDelay: 5, attemptIndex: 3 })).toBe(0);
    expect(deriveDeterministicRetryDelay({ retryDelayModel: 'deterministic_linear', baseDelay: 2, attemptIndex: 3 })).toBe(6);
    expect(deriveDeterministicRetryDelay({ retryDelayModel: 'deterministic_exponential', baseDelay: 2, attemptIndex: 3 })).toBe(8);
  });

  it('T-MTE-RP2 honors retry conditions and retry limits', () => {
    const retryable = evaluateTaskRetryEligibility({
      failureClass: 'RETRYABLE_FAILURE',
      currentRetryCount: 0,
    });

    const nonRetryable = evaluateTaskRetryEligibility({
      failureClass: 'POLICY_FAILURE',
      currentRetryCount: 0,
    });

    const exhausted = evaluateTaskRetryEligibility({
      failureClass: 'RETRYABLE_FAILURE',
      currentRetryCount: 3,
    });

    expect(retryable.eligible).toBe(true);
    expect(nonRetryable.eligible).toBe(false);
    expect(nonRetryable.reason).toBe('FAILURE_CLASS_NOT_RETRYABLE');
    expect(exhausted.eligible).toBe(false);
    expect(exhausted.reason).toBe('RETRY_LIMIT_EXCEEDED');
  });
});
