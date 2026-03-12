import { describe, expect, it } from 'vitest';

import { classifyTaskFailure } from '../../task-execution/task-failure-classifier.ts';

describe('task failure classifier', () => {
  it('T-MTE-RF1 classifies retryable failures deterministically', () => {
    const first = classifyTaskFailure({ failureCode: 'temporary_tool_error' });
    const second = classifyTaskFailure({ failureCode: 'temporary_tool_error' });

    expect(first).toEqual(second);
    expect(first.failureClass).toBe('RETRYABLE_FAILURE');
  });

  it('T-MTE-RF2 classifies non-retryable and policy failures by explicit mapping', () => {
    expect(classifyTaskFailure({ failureCode: 'invalid_input' }).failureClass).toBe('NON_RETRYABLE_FAILURE');
    expect(classifyTaskFailure({ failureCode: 'policy_violation' }).failureClass).toBe('POLICY_FAILURE');
    expect(classifyTaskFailure({ failureCode: 'dependency_failed' }).failureClass).toBe('DEPENDENCY_FAILURE');
  });

  it('T-MTE-RF3 explicit class overrides code mapping deterministically', () => {
    const result = classifyTaskFailure({
      failureCode: 'temporary_tool_error',
      explicitFailureClass: 'SYSTEM_FAILURE',
    });

    expect(result.failureClass).toBe('SYSTEM_FAILURE');
  });
});
