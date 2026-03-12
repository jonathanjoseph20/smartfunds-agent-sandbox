export interface ExecutionContractPolicy {
  executionPolicyId: string;
  displayName: string;
  description: string;
  requiresReadyActivationDecision: boolean;
  requiresConfirmedAssignmentDecision: boolean;
  requiresSelectedTeamAvailable: boolean;
  requiresSelectedTeamReady: boolean;
  requiresExplicitExecutionTarget: boolean;
  requiresFounderRuntimeApproval: boolean;
  enabled: boolean;
}
