export interface ExecutionAttemptPolicyConfig {
  defaultCapabilitiesDisabled: boolean;
  supportsCreation: boolean;
  supportsPreparation: boolean;
  supportsReadyForExecution: boolean;
  supportsExecution: boolean;
}

export interface ExecutionAttemptPolicy {
  executionAttemptPolicyId: string;
  displayName: string;
  description: string;
  enabled: boolean;
  config: ExecutionAttemptPolicyConfig;
}

export interface ExecutionAttemptEvaluationResult {
  attemptState: 'pending' | 'waiting_on_runtime_support' | 'blocked' | 'incomplete' | 'inconclusive';
  attemptLifecycleState: 'created' | 'prepared' | 'ready_for_execution' | 'cancelled';
  blockers: string[];
  limitations: string[];
}
