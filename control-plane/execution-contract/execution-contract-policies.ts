import type { ExecutionContractPolicy } from './execution-contract-policy-types.ts';

const SEEDED_POLICIES: ExecutionContractPolicy[] = [
  {
    executionPolicyId: 'strict-runtime-handoff-default',
    displayName: 'Strict Runtime Handoff Default',
    description: 'Requires confirmed assignment, ready activation, selected team readiness/availability, explicit target resolution, and explicit founder runtime approval.',
    requiresReadyActivationDecision: true,
    requiresConfirmedAssignmentDecision: true,
    requiresSelectedTeamAvailable: true,
    requiresSelectedTeamReady: true,
    requiresExplicitExecutionTarget: true,
    requiresFounderRuntimeApproval: true,
    enabled: true,
  },
  {
    executionPolicyId: 'manual-runtime-handoff-only',
    displayName: 'Manual Runtime Handoff Only',
    description: 'Evaluates deterministic preconditions and routes contract handoff through manual operator target with explicit governance review.',
    requiresReadyActivationDecision: true,
    requiresConfirmedAssignmentDecision: true,
    requiresSelectedTeamAvailable: false,
    requiresSelectedTeamReady: false,
    requiresExplicitExecutionTarget: true,
    requiresFounderRuntimeApproval: true,
    enabled: true,
  },
  {
    executionPolicyId: 'operator-reviewed-contract',
    displayName: 'Operator Reviewed Contract',
    description: 'Requires deterministic readiness checks but allows waiting on runtime preparation until operator review is completed.',
    requiresReadyActivationDecision: true,
    requiresConfirmedAssignmentDecision: true,
    requiresSelectedTeamAvailable: true,
    requiresSelectedTeamReady: true,
    requiresExplicitExecutionTarget: true,
    requiresFounderRuntimeApproval: false,
    enabled: true,
  },
];

export const DEFAULT_EXECUTION_CONTRACT_POLICY_ID = 'strict-runtime-handoff-default';

export function listExecutionContractPolicies(): ExecutionContractPolicy[] {
  return [...SEEDED_POLICIES].sort((left, right) => left.executionPolicyId.localeCompare(right.executionPolicyId));
}

export function getExecutionContractPolicy(executionPolicyId: string): ExecutionContractPolicy {
  const policy = SEEDED_POLICIES.find((entry) => entry.executionPolicyId === executionPolicyId && entry.enabled);
  if (!policy) {
    throw new Error(`EXECUTION_CONTRACT_POLICY_NOT_FOUND: ${executionPolicyId}`);
  }
  return policy;
}
