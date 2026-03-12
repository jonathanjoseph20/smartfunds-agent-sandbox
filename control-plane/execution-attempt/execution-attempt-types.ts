export const EXECUTION_ATTEMPT_LIFECYCLE_STATES = [
  'created',
  'prepared',
  'ready_for_execution',
  'running',
  'completed',
  'failed',
  'cancelled',
  'archived',
] as const;

export const EXECUTION_ATTEMPT_STATUSES = [
  'pending',
  'waiting_on_runtime_support',
  'blocked',
  'incomplete',
  'inconclusive',
] as const;

export const EXECUTION_ATTEMPT_HISTORY_EVENT_TYPES = [
  'execution_attempt_created',
  'execution_attempt_status_evaluated',
  'execution_attempt_materialized',
  'execution_attempt_cancelled',
] as const;

export const EXECUTION_ATTEMPT_EVALUATION_ERROR_CODES = [
  'RUNTIME_ENVELOPE_NOT_FOUND',
  'EXECUTION_ATTEMPT_NOT_FOUND',
  'INVALID_EXECUTION_ATTEMPT_INPUTS',
  'EXECUTION_ATTEMPT_POLICY_NOT_FOUND',
  'EXECUTION_ATTEMPT_POLICY_DISABLED',
] as const;

export type ExecutionAttemptLifecycleState = typeof EXECUTION_ATTEMPT_LIFECYCLE_STATES[number];
export type ExecutionAttemptStatus = typeof EXECUTION_ATTEMPT_STATUSES[number];
export type MissionExecutionAttemptHistoryEventType = typeof EXECUTION_ATTEMPT_HISTORY_EVENT_TYPES[number];
export type ExecutionAttemptEvaluationErrorCode = typeof EXECUTION_ATTEMPT_EVALUATION_ERROR_CODES[number];

export interface ExecutionAttemptInputs {
  inputParameters: Record<string, string>;
  environmentContext: Record<string, string>;
  targetRuntimeKind: string;
  resourceExpectations: Record<string, string>;
}

export interface ExecutionAttemptCapabilities {
  supportsTaskExecution: boolean;
  supportsRetries: boolean;
  supportsParallelTasks: boolean;
  supportsExternalCalls: boolean;
  supportsAgentInvocation: boolean;
}

export interface ExecutionAttemptProvenance {
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  executionPolicyId: string;
  runtimeEnvelopeState: string;
  runtimeEnvelopeEligibility: string;
  runtimeEnvelopeBlockers: string[];
  runtimeEnvelopeLimitations: string[];
}

export interface MissionExecutionAttempt {
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  attemptIndex: number;

  executionPolicyId: string;
  attemptState: ExecutionAttemptStatus;
  attemptLifecycleState: ExecutionAttemptLifecycleState;

  attemptInputs: ExecutionAttemptInputs;
  attemptCapabilities: ExecutionAttemptCapabilities;

  limitations: string[];
  blockers: string[];

  provenanceInputs: ExecutionAttemptProvenance;
}

export interface MissionExecutionAttemptHistoryEntry {
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  eventType: MissionExecutionAttemptHistoryEventType;
  eventDedupeKey: string;
  reasoning: string;
  payload: Record<string, unknown>;
}

export interface MissionExecutionAttemptHistory {
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  entries: MissionExecutionAttemptHistoryEntry[];
}

export interface MissionExecutionAttemptProjection extends MissionExecutionAttempt {
  historyDigest: string;
  historySummary: {
    totalEvents: number;
    lastEventType?: MissionExecutionAttemptHistoryEventType;
    lastEventDedupeKey?: string;
  };
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
    historyJsonPath: string;
    inputsJsonPath: string;
    capabilitiesJsonPath: string;
  };
}

export interface MissionExecutionAttemptMaterializationSummary {
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  inputsPath: string;
  capabilitiesPath: string;
}
