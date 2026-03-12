import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXECUTION_CONTRACT_POLICY_ID,
  getExecutionContractPolicy,
  listExecutionContractPolicies,
} from '../../execution-contract/execution-contract-policies.ts';

describe('execution contract policies', () => {
  it('T-MEC-P1 default policy is strict-runtime-handoff-default', () => {
    expect(DEFAULT_EXECUTION_CONTRACT_POLICY_ID).toBe('strict-runtime-handoff-default');
  });

  it('T-MEC-P2 seeded policies include all expected policies', () => {
    const ids = listExecutionContractPolicies().map((entry) => entry.executionPolicyId);
    expect(ids).toEqual([
      'manual-runtime-handoff-only',
      'operator-reviewed-contract',
      'strict-runtime-handoff-default',
    ]);
  });

  it('T-MEC-P3 strict default requires founder runtime approval', () => {
    const policy = getExecutionContractPolicy('strict-runtime-handoff-default');
    expect(policy.requiresFounderRuntimeApproval).toBe(true);
    expect(policy.requiresExplicitExecutionTarget).toBe(true);
  });

  it('T-MEC-P4 operator reviewed contract does not require founder runtime approval', () => {
    const policy = getExecutionContractPolicy('operator-reviewed-contract');
    expect(policy.requiresFounderRuntimeApproval).toBe(false);
    expect(policy.requiresReadyActivationDecision).toBe(true);
  });

  it('T-MEC-P5 manual runtime handoff policy resolves successfully', () => {
    const policy = getExecutionContractPolicy('manual-runtime-handoff-only');
    expect(policy.executionPolicyId).toBe('manual-runtime-handoff-only');
  });
});
