import { describe, expect, it } from 'vitest';

import type { GovernanceError } from '../diagnostics.ts';
import { selectRetryAction } from './retry-policy.ts';

function makeError(overrides: Partial<GovernanceError>): GovernanceError {
  return {
    code: 'MISSING_LABEL',
    severity: 'error',
    retryable: true,
    message: 'default',
    suggestedFix: null,
    sourceFields: [],
    ...overrides
  };
}

describe('retry policy', () => {
  it('selects retryable action deterministically from supported blocking errors', () => {
    const decision = selectRetryAction([
      makeError({ code: 'MISSING_EVIDENCE_BLOCK', message: 'evidence' }),
      makeError({ code: 'MISSING_LABEL', message: 'label' })
    ]);

    expect(decision.status).toBe('selected');
    if (decision.status === 'selected') {
      expect(decision.code).toBe('MISSING_EVIDENCE_BLOCK');
      expect(decision.blockingErrorCodes).toEqual(['MISSING_EVIDENCE_BLOCK', 'MISSING_LABEL']);
    }
  });

  it('ignores warnings when determining blocking set', () => {
    const decision = selectRetryAction([
      makeError({ code: 'UNOWNED_PATHS', severity: 'warning', retryable: false })
    ]);

    expect(decision).toEqual({
      status: 'no-blocking',
      blockingErrorCodes: []
    });
  });

  it('returns unsupported when any unsupported blocking error exists', () => {
    const decision = selectRetryAction([
      makeError({ code: 'MISSING_LABEL' }),
      makeError({ code: 'OWNERSHIP_VIOLATION', retryable: false })
    ]);

    expect(decision.status).toBe('unsupported');
    if (decision.status === 'unsupported') {
      expect(decision.unsupportedBlockingCodes).toEqual(['OWNERSHIP_VIOLATION']);
      expect(decision.blockingErrorCodes).toEqual(['MISSING_LABEL', 'OWNERSHIP_VIOLATION']);
    }
  });
});
