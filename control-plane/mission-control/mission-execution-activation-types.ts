export const EXECUTION_ACTIVATION_RECORD_STATES = [
  'created',
  'queued',
  'submitted',
  'active',
  'deferred',
  'completed',
  'failed',
  'inconclusive',
] as const;

export const EXECUTION_REQUEST_ACTIVATION_MAPPING_STATES = [
  'active',
  'deprecated',
] as const;

export const EXECUTION_ACTIVATION_ELIGIBILITY_VALUES = [
  'not_eligible',
  'conditionally_eligible',
  'eligible',
  'blocked_from_activation',
  'inconclusive',
] as const;

export const EXECUTION_ACTIVATION_STATUS_VALUES = [
  'not_started',
  'pending_activation',
  'handoff_submitted',
  'activation_active',
  'activation_completed',
  'activation_failed',
  'activation_deferred',
  'inconclusive',
] as const;

export const EXECUTION_ACTIVATION_OUTCOME_VALUES = [
  'pending',
  'submitted',
  'active',
  'partially_completed',
  'completed',
  'failed',
  'deferred',
  'inconclusive',
] as const;

export const MISSION_EXECUTION_ACTIVATION_QUEUE_STATES = [
  'queued',
  'awaiting_handoff',
  'handoff_submitted',
  'under_activation',
  'deferred',
  'closed',
  'blocked',
] as const;

export const EXECUTION_ACTIVATION_FEEDBACK_CLASSES = [
  'handoff_submitted',
  'execution_started',
  'execution_completed',
  'execution_failed',
  'execution_blocked',
  'execution_inconclusive',
] as const;

export const EXECUTION_ACTIVATION_FEEDBACK_STATES = [
  'linked',
  'processed',
] as const;

export const EXECUTION_ACTIVATION_RULES = [
  'standard_task_activation',
  'monitoring_activation',
  'review_activation',
  'stabilization_followup_activation',
] as const;

export const EXECUTION_ACTIVATION_HISTORY_EVENT_TYPES = [
  'execution_activation_record_created',
  'execution_activation_eligibility_evaluated',
  'execution_activation_queued',
  'execution_activation_handoff_submitted',
  'execution_activation_feedback_linked',
  'execution_activation_deferred',
  'execution_activation_completed',
  'execution_activation_failed',
  'mission_execution_activation_materialized',
] as const;

export type ExecutionActivationRecordState = typeof EXECUTION_ACTIVATION_RECORD_STATES[number];
export type ExecutionRequestActivationMappingState = typeof EXECUTION_REQUEST_ACTIVATION_MAPPING_STATES[number];
export type ExecutionActivationEligibilityValue = typeof EXECUTION_ACTIVATION_ELIGIBILITY_VALUES[number];
export type ExecutionActivationStatus = typeof EXECUTION_ACTIVATION_STATUS_VALUES[number];
export type ExecutionActivationOutcomeValue = typeof EXECUTION_ACTIVATION_OUTCOME_VALUES[number];
export type MissionExecutionActivationQueueState = typeof MISSION_EXECUTION_ACTIVATION_QUEUE_STATES[number];
export type ExecutionActivationFeedbackClass = typeof EXECUTION_ACTIVATION_FEEDBACK_CLASSES[number];
export type ExecutionActivationFeedbackState = typeof EXECUTION_ACTIVATION_FEEDBACK_STATES[number];
export type ExecutionActivationRule = typeof EXECUTION_ACTIVATION_RULES[number];
export type ExecutionActivationHistoryEventType = typeof EXECUTION_ACTIVATION_HISTORY_EVENT_TYPES[number];

export interface ExecutionActivationRecord {
  executionActivationRecordId: string;
  executionRequestRecordId: string;
  missionExecutionCoordinationPlanId: string;
  executionIntentId: string;
  targetExecutionDomain: string;
  priority: string;
  state: ExecutionActivationRecordState;
  outcome: ExecutionActivationOutcomeValue;
}

export interface ExecutionRequestActivationMapping {
  executionRequestActivationMappingId: string;
  executionRequestRecordId: string;
  executionActivationRecordId: string;
  activationRule: ExecutionActivationRule;
  reasonTokens: string[];
  state: ExecutionRequestActivationMappingState;
}

export interface ExecutionActivationEligibility {
  executionActivationEligibilityId: string;
  executionRequestRecordId: string;
  eligibilityStatus: ExecutionActivationEligibilityValue;
  reasonTokens: string[];
  blockingConditionTokens: string[];
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface MissionExecutionActivationQueueEntry {
  missionExecutionActivationQueueEntryId: string;
  executionActivationRecordId: string;
  priority: string;
  queueState: MissionExecutionActivationQueueState;
  reasonTokens: string[];
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface ExecutionActivationFeedbackLink {
  executionActivationFeedbackLinkId: string;
  executionActivationRecordId: string;
  executionRequestRecordId: string;
  executionAttemptId: string | null;
  taskExecutionRunId: string | null;
  workerResultId: string | null;
  feedbackClass: ExecutionActivationFeedbackClass;
  state: ExecutionActivationFeedbackState;
}

export interface ExecutionActivationStatusRecord {
  executionActivationRecordId: string;
  status: ExecutionActivationStatus;
  reasonTokens: string[];
}

export interface ExecutionActivationOutcome {
  executionActivationRecordId: string;
  outcome: ExecutionActivationOutcomeValue;
  reasonTokens: string[];
}

export interface ExecutionActivationHistoryEvent {
  executionActivationRecordId: string;
  eventType: ExecutionActivationHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface ExecutionActivationHistory {
  executionActivationRecordId: string;
  entries: ExecutionActivationHistoryEvent[];
}

export interface MissionExecutionActivationProjection {
  executionActivationRecordId: string;
  executionRequestRecordId: string;
  missionExecutionCoordinationPlanId: string;
  eligibilityStatus: ExecutionActivationEligibilityValue;
  queueState: MissionExecutionActivationQueueState | null;
  feedbackLinkSummaries: ExecutionActivationFeedbackLink[];
  status: ExecutionActivationStatusRecord;
  outcome: ExecutionActivationOutcome;
  priority: string;
  linkedExecutionAttemptIds: string[];
  activationHistory: ExecutionActivationHistory;
  activationRecord: ExecutionActivationRecord;
  mapping: ExecutionRequestActivationMapping;
  eligibility: ExecutionActivationEligibility;
  queueEntry: MissionExecutionActivationQueueEntry | null;
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}
