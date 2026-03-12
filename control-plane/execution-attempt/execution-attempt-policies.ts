import type { ExecutionAttemptPolicy } from './execution-attempt-policy-types.ts';

const SEEDED_POLICIES: ExecutionAttemptPolicy[] = [
  {
    executionAttemptPolicyId: 'strict-pre-execution-default',
    displayName: 'Strict Pre-Execution Default',
    description: 'Creates deterministic execution-attempt envelopes with execution disabled.',
    enabled: true,
    config: {
      defaultCapabilitiesDisabled: true,
      supportsCreation: true,
      supportsPreparation: true,
      supportsReadyForExecution: true,
      supportsExecution: false,
    },
  },
  {
    executionAttemptPolicyId: 'manual-preparation-review',
    displayName: 'Manual Preparation Review',
    description: 'Prepares deterministic execution attempts while explicitly waiting on runtime support.',
    enabled: true,
    config: {
      defaultCapabilitiesDisabled: true,
      supportsCreation: true,
      supportsPreparation: true,
      supportsReadyForExecution: true,
      supportsExecution: false,
    },
  },
  {
    executionAttemptPolicyId: 'future-execution-enabled',
    displayName: 'Future Execution Enabled',
    description: 'Reserved policy for future runtime execution support; disabled in Sprint 5.3.',
    enabled: false,
    config: {
      defaultCapabilitiesDisabled: true,
      supportsCreation: true,
      supportsPreparation: true,
      supportsReadyForExecution: true,
      supportsExecution: false,
    },
  },
];

export const DEFAULT_EXECUTION_ATTEMPT_POLICY_ID = 'strict-pre-execution-default';

export function listExecutionAttemptPolicies(): ExecutionAttemptPolicy[] {
  return [...SEEDED_POLICIES].sort((left, right) => left.executionAttemptPolicyId.localeCompare(right.executionAttemptPolicyId));
}

export function getExecutionAttemptPolicy(executionAttemptPolicyId: string): ExecutionAttemptPolicy {
  const policy = SEEDED_POLICIES.find((entry) => entry.executionAttemptPolicyId === executionAttemptPolicyId);
  if (!policy) {
    throw new Error(`EXECUTION_ATTEMPT_POLICY_NOT_FOUND: ${executionAttemptPolicyId}`);
  }
  return policy;
}
