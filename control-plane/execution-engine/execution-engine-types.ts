export const EXECUTION_ENGINE_STATES = [
  'initialized',
  'eligible_to_start',
  'started',
  'running',
  'completed',
  'failed',
  'cancelled',
  'archived',
] as const;

export const EXECUTION_ENGINE_ELIGIBILITY_STATES = [
  'eligible',
  'waiting_on_support',
  'blocked',
  'incomplete',
  'inconclusive',
] as const;

export const EXECUTION_ENGINE_RUN_MODES = [
  'simulation_only',
  'bounded_local_execution',
  'manual_engine_gate',
] as const;

export const EXECUTION_ENGINE_HISTORY_EVENT_TYPES = [
  'engine_run_initialized',
  'engine_run_eligible',
  'engine_run_started',
  'engine_run_completed',
  'engine_run_failed',
  'engine_run_cancelled',
  'engine_run_materialized',
] as const;

export const EXECUTION_ENGINE_ERROR_CODES = [
  'EXECUTION_ENGINE_RUN_NOT_FOUND',
  'EXECUTION_ENGINE_INVALID_TRANSITION',
  'EXECUTION_ENGINE_POLICY_NOT_FOUND',
  'EXECUTION_ENGINE_POLICY_DISABLED',
  'EXECUTION_ENGINE_REASON_REQUIRED',
] as const;

export type ExecutionEngineState = typeof EXECUTION_ENGINE_STATES[number];
export type ExecutionEngineEligibilityState = typeof EXECUTION_ENGINE_ELIGIBILITY_STATES[number];
export type ExecutionEngineRunMode = typeof EXECUTION_ENGINE_RUN_MODES[number];
export type ExecutionEngineHistoryEventType = typeof EXECUTION_ENGINE_HISTORY_EVENT_TYPES[number];
export type ExecutionEngineErrorCode = typeof EXECUTION_ENGINE_ERROR_CODES[number];

export interface ExecutionEngineRunInputs {
  normalizedRuntimePayload: Record<string, unknown>;
  executionTarget: string;
  allowedActions: string[];
  prohibitedActions: string[];
  capabilityFlags: Record<string, boolean>;
  engineMetadata: Record<string, string>;
}

export interface ExecutionEngineRunOutputs {
  outputState: 'not_started' | 'running' | 'completed' | 'failed' | 'cancelled';
  resultSummary: string;
  generatedArtifacts: string[];
  completionReason?: string;
  failureReason?: string;
}

export interface ExecutionEngineProvenanceInputs {
  attemptState: string;
  attemptLifecycleState: string;
  attemptBlockers: string[];
  attemptLimitations: string[];
  journalState: string;
  journalEventCount: number;
  journalBlockers: string[];
  journalLimitations: string[];
  runtimeEnvelopeState: string;
  runtimeEnvelopeEligibility: string;
  runtimeEnvelopeBlockers: string[];
  runtimeEnvelopeLimitations: string[];
  contractState: string;
  contractEligibilityState: string;
  contractBlockers: string[];
  contractLimitations: string[];
}

export interface MissionExecutionEngineRun {
  executionEngineRunId: string;
  executionAttemptId: string;
  executionJournalId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  selectedTeamId: string;
  enginePolicyId: string;
  engineState: ExecutionEngineState;
  engineEligibilityState: ExecutionEngineEligibilityState;
  runMode: ExecutionEngineRunMode;
  runInputs: ExecutionEngineRunInputs;
  runOutputs: ExecutionEngineRunOutputs;
  blockingReasons: string[];
  limitations: string[];
  provenanceInputs: ExecutionEngineProvenanceInputs;
  historyDigest: string;
}

export interface MissionExecutionEngineHistoryEntry {
  executionEngineRunId: string;
  executionAttemptId: string;
  executionJournalId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  eventType: ExecutionEngineHistoryEventType;
  eventDedupeKey: string;
  reasoning: string;
  payload: Record<string, unknown>;
}

export interface MissionExecutionEngineHistory {
  executionEngineRunId: string;
  executionAttemptId: string;
  executionJournalId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  entries: MissionExecutionEngineHistoryEntry[];
}

export interface MissionExecutionEngineRunProjection extends MissionExecutionEngineRun {
  historySummary: {
    totalEvents: number;
    lastEventType?: ExecutionEngineHistoryEventType;
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
    outputsJsonPath: string;
  };
}

export interface MissionExecutionEngineMaterializationSummary {
  executionEngineRunId: string;
  executionAttemptId: string;
  executionJournalId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  outputsPath: string;
}
