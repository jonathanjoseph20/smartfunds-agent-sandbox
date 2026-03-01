import { describe, expect, it } from 'vitest';

import { classifyFailure, computeFailureSignature, type NormalizedFailure } from './error-classification.ts';

function failure(overrides: Partial<NormalizedFailure>): NormalizedFailure {
  return {
    checkName: 'run_swarm',
    category: 'unknown',
    normalizedMessage: 'failed',
    ...overrides
  };
}

describe('error classification', () => {
  it('maps deterministic categories and governance sub-codes', () => {
    expect(classifyFailure(failure({ category: 'lint' })).errorClass).toBe('LINT_FAILURE');
    expect(classifyFailure(failure({ category: 'typecheck' })).errorClass).toBe('TYPECHECK_FAILURE');
    expect(classifyFailure(failure({ category: 'unit' })).errorClass).toBe('UNIT_TEST_FAILURE');
    expect(classifyFailure(failure({ category: 'integration' })).errorClass).toBe('INTEGRATION_TEST_FAILURE');
    expect(classifyFailure(failure({ category: 'schema' })).errorClass).toBe('SCHEMA_VALIDATION_FAILURE');
    expect(classifyFailure(failure({ category: 'infra' })).errorClass).toBe('TRANSIENT_INFRA_ERROR');
    expect(classifyFailure(failure({ category: 'unknown' })).errorClass).toBe('UNKNOWN_FAILURE');

    expect(classifyFailure(failure({ category: 'governance', code: 'OWNERSHIP_VIOLATION' })).errorClass).toBe('OWNERSHIP_VIOLATION');
    expect(classifyFailure(failure({ category: 'governance', code: 'TIER_MISMATCH' })).errorClass).toBe('TIER_MISMATCH');
    expect(classifyFailure(failure({ category: 'governance', code: 'MISSING_EVIDENCE_BLOCK' })).errorClass).toBe('EVIDENCE_SCHEMA_ERROR');
    expect(classifyFailure(failure({ category: 'governance', code: 'OTHER' })).errorClass).toBe('GOVERNANCE_ERROR');
  });

  it('produces stable failure signatures including code=null semantics', () => {
    const first = classifyFailure(failure({ category: 'lint', normalizedMessage: 'x', code: undefined })).failureSignature;
    const second = classifyFailure(failure({ category: 'lint', normalizedMessage: 'x' })).failureSignature;
    expect(first).toBe(second);

    const signature = computeFailureSignature({
      errorClass: 'LINT_FAILURE',
      checkName: 'run_swarm',
      normalizedMessage: 'x'
    });
    expect(signature).toMatchInlineSnapshot(`"fce1faf7b8ff5744afd3b4e463799bfb2659903cd1797b43488606c37f0f1467"`);
  });
});
