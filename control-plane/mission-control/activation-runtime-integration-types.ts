export const ACTIVATION_DISPATCH_ATTEMPT_STATES = [
  'created',
  'queued',
  'submitted',
  'active',
  'deferred',
  'completed',
  'failed',
  'inconclusive',
] as const;

export const ACTIVATION_DISPATCH_QUEUE_STATES = [
  'queued',
  'awaiting_dispatch',
  'dispatch_submitted',
  'under_runtime_execution',
  'deferred',
  'blocked',
  'closed',
] as const;

export const ACTIVATION_RUNTIME_LINK_CLASSES = [
  'dispatch_submitted',
  'runtime_started',
  'runtime_completed',
  'runtime_failed',
  'runtime_retrying',
  'runtime_inconclusive',
] as const;

export const RUNTIME_FEEDBACK_INGESTION_CLASSES = [
  'runtime_dispatch_accepted',
  'runtime_execution_started',
  'runtime_execution_completed',
  'runtime_execution_failed',
  'runtime_execution_blocked',
  'runtime_execution_retrying',
  'runtime_execution_inconclusive',
] as const;

export const ACTIVATION_ATTEMPT_STATUS_VALUES = [
  'not_dispatched',
  'pending_dispatch',
  'dispatch_submitted',
  'runtime_active',
  'runtime_completed',
  'runtime_failed',
  'runtime_deferred',
  'inconclusive',
] as const;

export const ACTIVATION_ATTEMPT_OUTCOME_VALUES = [
  'pending',
  'submitted',
  'active',
  'partially_completed',
  'completed',
  'failed',
  'deferred',
  'inconclusive',
] as const;

export const ACTIVATION_RUNTIME_RECONCILIATION_CLASSES = [
  'feedback_applied',
  'feedback_conflict',
  'feedback_incomplete',
  'feedback_deferred',
  'feedback_inconclusive',
] as const;

export const ACTIVATION_RUNTIME_INTEGRATION_HISTORY_EVENT_TYPES = [
  'activation_dispatch_attempt_created',
  'activation_dispatch_queued',
  'activation_dispatch_submitted',
  'activation_runtime_link_created',
  'runtime_feedback_ingested',
  'activation_runtime_reconciliation_applied',
  'activation_runtime_deferred',
  'activation_runtime_completed',
  'activation_runtime_failed',
  'activation_runtime_materialized',
] as const;

export type ActivationDispatchAttemptState = typeof ACTIVATION_DISPATCH_ATTEMPT_STATES[number];
export type ActivationDispatchQueueState = typeof ACTIVATION_DISPATCH_QUEUE_STATES[number];
export type ActivationRuntimeLinkClass = typeof ACTIVATION_RUNTIME_LINK_CLASSES[number];
export type RuntimeFeedbackIngestionClass = typeof RUNTIME_FEEDBACK_INGESTION_CLASSES[number];
export type ActivationAttemptStatus = typeof ACTIVATION_ATTEMPT_STATUS_VALUES[number];
export type ActivationAttemptOutcomeValue = typeof ACTIVATION_ATTEMPT_OUTCOME_VALUES[number];
export type ActivationRuntimeReconciliationClass = typeof ACTIVATION_RUNTIME_RECONCILIATION_CLASSES[number];
export type ActivationRuntimeIntegrationHistoryEventType = typeof ACTIVATION_RUNTIME_INTEGRATION_HISTORY_EVENT_TYPES[number];

export interface ActivationDispatchAttempt {
  activationDispatchAttemptId: string;
  executionActivationRecordId: string;
  executionRequestRecordId: string;
  targetRuntimeDomain: string;
  priority: string;
  state: ActivationDispatchAttemptState;
  outcome: ActivationAttemptOutcomeValue;
}

export interface ActivationDispatchQueueEntry {
  activationDispatchQueueEntryId: string;
  activationDispatchAttemptId: string;
  priority: string;
  queueState: ActivationDispatchQueueState;
  reasonTokens: string[];
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface RuntimeLinkedIds {
  executionAttemptId: string | null;
  taskExecutionRunId: string | null;
  workerResultId: string | null;
}

export interface ActivationRuntimeLink {
  activationRuntimeLinkId: string;
  activationDispatchAttemptId: string;
  executionActivationRecordId: string;
  executionAttemptId: string | null;
  taskExecutionRunId: string | null;
  workerResultId: string | null;
  runtimeLinkClass: ActivationRuntimeLinkClass;
  state: 'linked' | 'processed';
}

export interface RuntimeFeedbackIngestionRecord {
  runtimeFeedbackIngestionRecordId: string;
  activationDispatchAttemptId: string;
  activationRuntimeLinkId: string;
  feedbackClass: RuntimeFeedbackIngestionClass;
  reasonTokens: string[];
  linkedRuntimeIds: RuntimeLinkedIds;
  state: 'ingested' | 'processed';
}

export interface ActivationAttemptStatusRecord {
  activationDispatchAttemptId: string;
  status: ActivationAttemptStatus;
  reasonTokens: string[];
}

export interface ActivationAttemptOutcome {
  activationDispatchAttemptId: string;
  outcome: ActivationAttemptOutcomeValue;
  reasonTokens: string[];
}

export interface ActivationRuntimeReconciliation {
  activationRuntimeReconciliationId: string;
  activationDispatchAttemptId: string;
  reconciliationClass: ActivationRuntimeReconciliationClass;
  reasonTokens: string[];
  linkedFeedbackRecordIds: string[];
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface ActivationRuntimeIntegrationHistoryEvent {
  activationDispatchAttemptId: string;
  eventType: ActivationRuntimeIntegrationHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface ActivationRuntimeIntegrationHistory {
  activationDispatchAttemptId: string;
  entries: ActivationRuntimeIntegrationHistoryEvent[];
}

export interface ActivationRuntimeIntegrationProjection {
  activationDispatchAttemptId: string;
  executionActivationRecordId: string;
  dispatchQueueState: ActivationDispatchQueueState;
  runtimeLinkSummaries: ActivationRuntimeLink[];
  feedbackIngestionSummaries: RuntimeFeedbackIngestionRecord[];
  reconciliationSummaries: ActivationRuntimeReconciliation[];
  status: ActivationAttemptStatusRecord;
  outcome: ActivationAttemptOutcome;
  priority: string;
  linkedExecutionAttemptIds: string[];
  integrationHistory: ActivationRuntimeIntegrationHistory;
  dispatchAttempt: ActivationDispatchAttempt;
  dispatchQueueEntry: ActivationDispatchQueueEntry;
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}
