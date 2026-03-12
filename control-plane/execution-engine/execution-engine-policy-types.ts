import type { ExecutionEngineRunMode } from './execution-engine-types.ts';

export interface ExecutionEnginePolicy {
  enginePolicyId: string;
  displayName: string;
  description: string;
  requiresEligibleAttempt: boolean;
  requiresReadyJournal: boolean;
  requiresEligibleRuntimeEnvelope: boolean;
  requiresExecutionContractReady: boolean;
  allowsLiveExecution: boolean;
  allowsSimulationOnly: boolean;
  requiresFounderEngineConfirmation: boolean;
  enabled: boolean;
  defaultRunMode: ExecutionEngineRunMode;
}
