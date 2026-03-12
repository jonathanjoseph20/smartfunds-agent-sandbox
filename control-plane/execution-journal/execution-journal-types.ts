export const EXECUTION_JOURNAL_STATES = [
  'initialized',
  'collecting',
  'ready_for_runtime_events',
  'blocked',
  'archived',
] as const;

export const EXECUTION_JOURNAL_EVENT_TYPES = [
  'attempt_created',
  'attempt_prepared',
  'attempt_ready_for_execution',
  'attempt_cancelled',
  'journal_materialized',
  'execution_started',
  'execution_progressed',
  'execution_completed',
  'execution_failed',
  'execution_retried',
] as const;

export const EXECUTION_JOURNAL_RESERVED_EVENT_TYPES = [
  'execution_started',
  'execution_progressed',
  'execution_completed',
  'execution_failed',
  'execution_retried',
] as const;

export const EXECUTION_JOURNAL_LIVE_EVENT_TYPES = [
  'attempt_created',
  'attempt_prepared',
  'attempt_ready_for_execution',
  'attempt_cancelled',
  'journal_materialized',
] as const;

export type ExecutionJournalState = typeof EXECUTION_JOURNAL_STATES[number];
export type ExecutionJournalEventType = typeof EXECUTION_JOURNAL_EVENT_TYPES[number];
export type ReservedExecutionJournalEventType = typeof EXECUTION_JOURNAL_RESERVED_EVENT_TYPES[number];
export type LiveExecutionJournalEventType = typeof EXECUTION_JOURNAL_LIVE_EVENT_TYPES[number];

export interface ExecutionJournalEvent {
  eventType: ExecutionJournalEventType;
  eventDedupeKey: string;
  executionJournalId: string;
  executionAttemptId: string;
  eventIndex: number;
  eventPayload: Record<string, unknown>;
  reasonTokens: string[];
  blockingReasons: string[];
  limitations: string[];
}

export interface MissionExecutionJournal {
  executionJournalId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  attemptIndex: number;
  journalState: ExecutionJournalState;
  eventCount: number;
  latestEventType?: ExecutionJournalEventType;
  latestEventDigest?: string;
  events: ExecutionJournalEvent[];
  limitations: string[];
  blockers: string[];
  provenanceInputs: {
    attemptState: string;
    attemptLifecycleState: string;
    attemptBlockers: string[];
    attemptLimitations: string[];
  };
}

export interface ExecutionJournalProjection extends MissionExecutionJournal {
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
    historyJsonPath: string;
    eventsJsonPath: string;
  };
}

export interface ExecutionJournalMaterializationSummary {
  executionJournalId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  eventsPath: string;
}

export interface ExecutionJournalStatus {
  journalState: ExecutionJournalState;
  blockers: string[];
  limitations: string[];
  readinessSignals: string[];
}
