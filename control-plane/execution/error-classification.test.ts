import { describe, expect, it } from 'vitest';

import { classifyFailure, computeFailureSignature, type NormalizedFailure } from './error-classification.ts';

function baseFailure(overrides: Partial<NormalizedFailure>): NormalizedFailure {
  return {
    checkName: 'lint',
    failureType: 'LINT_FAILURE',
    normalizedMessage: 'lint failed',
    tier: 3,
    impliedTier: 3,
    requiredChecks: ['lint'],
    ...overrides
  };
}

describe('error classification', () => {
  it('locks precedence: governance/ownership/tier/evidence outrank lint/tests', () => {
    expect(classifyFailure(baseFailure({ checkName: 'governance', failureType: 'LINT_FAILURE' }))).toBe('GOVERNANCE_ERROR');
    expect(classifyFailure(baseFailure({ checkName: 'ownership', failureType: 'LINT_FAILURE' }))).toBe('OWNERSHIP_VIOLATION');
    expect(classifyFailure(baseFailure({ checkName: 'tier-check', failureType: 'LINT_FAILURE' }))).toBe('TIER_MISMATCH');
    expect(classifyFailure(baseFailure({ checkName: 'evidence-parse', failureType: 'LINT_FAILURE' }))).toBe('EVIDENCE_SCHEMA_ERROR');
  });

  it('maps deterministic check/failure types with no fuzzy behavior', () => {
    expect(classifyFailure(baseFailure({ checkName: 'lint', failureType: 'LINT_FAILURE' }))).toBe('LINT_FAILURE');
    expect(classifyFailure(baseFailure({ checkName: 'typecheck', failureType: 'TYPECHECK_FAILURE' }))).toBe('TYPECHECK_FAILURE');
    expect(classifyFailure(baseFailure({ checkName: 'unit_test', failureType: 'UNIT_TEST_FAILURE' }))).toBe('UNIT_TEST_FAILURE');
    expect(classifyFailure(baseFailure({ checkName: 'integration_test', failureType: 'INTEGRATION_TEST_FAILURE' }))).toBe('INTEGRATION_TEST_FAILURE');
    expect(classifyFailure(baseFailure({ checkName: 'schema', failureType: 'SCHEMA_VALIDATION_FAILURE' }))).toBe('SCHEMA_VALIDATION_FAILURE');
    expect(classifyFailure(baseFailure({ checkName: 'infra', failureType: 'TRANSIENT_INFRA_ERROR' }))).toBe('TRANSIENT_INFRA_ERROR');
    expect(classifyFailure(baseFailure({ checkName: 'misc', failureType: 'SOMETHING_ELSE' }))).toBe('UNKNOWN_FAILURE');
  });

  it('computes deterministic failure signatures', () => {
    const first = computeFailureSignature({
      errorClass: 'LINT_FAILURE',
      checkName: 'lint',
      normalizedMessage: 'failure'
    });
    const second = computeFailureSignature({
      errorClass: 'LINT_FAILURE',
      checkName: 'lint',
      normalizedMessage: 'failure'
    });

    expect(first).toBe(second);
  });
});
