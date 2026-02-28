import { describe, expect, it } from 'vitest';

import { selectGoverningFailure } from './select-governing-failure.ts';
import type { NormalizedCheck } from './types.ts';

function check(input: Partial<NormalizedCheck> & Pick<NormalizedCheck, 'name'>): NormalizedCheck {
  return {
    name: input.name,
    conclusion: input.conclusion ?? 'failure',
    classification: input.classification ?? 'non_governance',
    extracted: {
      governanceErrorCode: input.extracted?.governanceErrorCode ?? null,
      governanceErrorJson: input.extracted?.governanceErrorJson ?? null
    }
  };
}

describe('governing failure selection', () => {
  it('prioritizes governance failures over non-governance failures', () => {
    const result = selectGoverningFailure([
      check({ name: 'unit_tests', classification: 'non_governance' }),
      check({ name: 'governance', classification: 'governance' })
    ]);

    expect(result.governingFailure?.name).toBe('governance');
    expect(result.reason).toBe('GOVERNANCE_FAILURE_PRESENT');
  });

  it('selects lexicographically for non-governance failures only', () => {
    const result = selectGoverningFailure([
      check({ name: 'zeta-tests', classification: 'non_governance' }),
      check({ name: 'alpha-tests', classification: 'non_governance' })
    ]);

    expect(result.governingFailure?.name).toBe('alpha-tests');
    expect(result.reason).toBe('ONLY_NON_GOVERNANCE_FAILURES');
  });
});
