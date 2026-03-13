export const MISSION_EXECUTION_COORDINATION_PLAN_STATES = [
  'created',
  'queued',
  'active',
  'deferred',
  'completed',
  'failed',
  'inconclusive',
] as const;

export const MISSION_ORCHESTRATION_EXECUTION_MAPPING_STATES = [
  'active',
  'deprecated',
] as const;

export const EXECUTION_INTENT_CLASSES = [
  'monitoring_task_intent',
  'review_request_intent',
  'reassessment_intent',
  'stabilization_task_intent',
  'blocking_cluster_followup_intent',
  'watch_state_maintenance_intent',
] as const;

export const EXECUTION_INTENT_STATES = [
  'created',
  'queued',
  'active',
  'deferred',
  'completed',
  'failed',
  'inconclusive',
] as const;

export const EXECUTION_REQUEST_STATES = [
  'created',
  'queued',
  'submitted',
  'active',
  'completed',
  'failed',
  'deferred',
  'inconclusive',
] as const;

export const EXECUTION_REQUEST_CLASSES = [
  'task_execution_request',
  'monitoring_request',
  'review_execution_request',
  'stabilization_request',
] as const;

export const EXECUTION_FEEDBACK_CLASSES = [
  'execution_started',
  'execution_completed',
  'execution_failed',
  'execution_blocked',
  'execution_retrying',
  'execution_inconclusive',
] as const;

export const EXECUTION_FEEDBACK_STATES = [
  'linked',
  'processed',
] as const;

export const MISSION_EXECUTION_COORDINATION_STATUS_VALUES = [
  'not_started',
  'pending_execution',
  'execution_active',
  'execution_completed',
  'execution_failed',
  'execution_deferred',
  'inconclusive',
] as const;

export const MISSION_EXECUTION_COORDINATION_OUTCOME_VALUES = [
  'pending',
  'active',
  'partially_completed',
  'completed',
  'failed',
  'deferred',
  'inconclusive',
] as const;

export const MISSION_EXECUTION_COORDINATION_HISTORY_EVENT_TYPES = [
  'mission_execution_coordination_plan_created',
  'execution_intent_created',
  'execution_request_record_created',
  'execution_request_queued',
  'execution_request_submitted',
  'execution_feedback_linked',
  'execution_coordination_deferred',
  'execution_coordination_completed',
  'execution_coordination_failed',
  'mission_execution_materialized',
] as const;

export type MissionExecutionCoordinationPlanState = typeof MISSION_EXECUTION_COORDINATION_PLAN_STATES[number];
export type MissionOrchestrationExecutionMappingState = typeof MISSION_ORCHESTRATION_EXECUTION_MAPPING_STATES[number];
export type ExecutionIntentClass = typeof EXECUTION_INTENT_CLASSES[number];
export type ExecutionIntentState = typeof EXECUTION_INTENT_STATES[number];
export type ExecutionRequestState = typeof EXECUTION_REQUEST_STATES[number];
export type ExecutionRequestClass = typeof EXECUTION_REQUEST_CLASSES[number];
export type ExecutionFeedbackClass = typeof EXECUTION_FEEDBACK_CLASSES[number];
export type ExecutionFeedbackState = typeof EXECUTION_FEEDBACK_STATES[number];
export type MissionExecutionCoordinationStatus = typeof MISSION_EXECUTION_COORDINATION_STATUS_VALUES[number];
export type MissionExecutionCoordinationOutcome = typeof MISSION_EXECUTION_COORDINATION_OUTCOME_VALUES[number];
export type MissionExecutionCoordinationHistoryEventType = typeof MISSION_EXECUTION_COORDINATION_HISTORY_EVENT_TYPES[number];

export interface MissionExecutionCoordinationPlan {
  missionExecutionCoordinationPlanId: string;
  missionControlInterventionPlanId: string;
  displayName: string;
  strategyClass: string;
  executionIntentIds: string[];
  executionRequestIds: string[];
  priority: string;
  state: MissionExecutionCoordinationPlanState;
  outcome: MissionExecutionCoordinationOutcome;
}

export interface MissionOrchestrationExecutionMapping {
  missionOrchestrationExecutionMappingId: string;
  missionControlOrchestrationActionItemId: string;
  executionIntentClass: ExecutionIntentClass;
  requestGenerationRule: string;
  reasonTokens: string[];
  state: MissionOrchestrationExecutionMappingState;
}

export interface ExecutionIntent {
  executionIntentId: string;
  missionExecutionCoordinationPlanId: string;
  intentClass: ExecutionIntentClass;
  reasonTokens: string[];
  linkedActionItemIds: string[];
  state: ExecutionIntentState;
}

export interface ExecutionRequestRecord {
  executionRequestRecordId: string;
  missionExecutionCoordinationPlanId: string;
  missionControlOrchestrationActionItemId: string;
  executionIntentId: string;
  requestClass: ExecutionRequestClass;
  targetExecutionDomain: string;
  priority: string;
  state: ExecutionRequestState;
  reasonTokens: string[];
}

export interface ExecutionFeedbackLink {
  executionFeedbackLinkId: string;
  executionRequestRecordId: string;
  executionAttemptId: string | null;
  taskExecutionRunId: string | null;
  workerResultId: string | null;
  missionControlOrchestrationActionItemId: string;
  missionExecutionCoordinationPlanId: string;
  feedbackClass: ExecutionFeedbackClass;
  state: ExecutionFeedbackState;
}

export interface MissionExecutionCoordinationStatusRecord {
  missionExecutionCoordinationPlanId: string;
  status: MissionExecutionCoordinationStatus;
  reasonTokens: string[];
}

export interface MissionExecutionCoordinationOutcomeRecord {
  missionExecutionCoordinationPlanId: string;
  outcome: MissionExecutionCoordinationOutcome;
  reasonTokens: string[];
}

export interface MissionExecutionCoordinationHistoryEntry {
  missionExecutionCoordinationPlanId: string;
  eventType: MissionExecutionCoordinationHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface MissionExecutionCoordinationHistory {
  missionExecutionCoordinationPlanId: string;
  entries: MissionExecutionCoordinationHistoryEntry[];
}

export interface MissionExecutionCoordinationProjection {
  missionExecutionCoordinationPlanId: string;
  missionControlInterventionPlanId: string;
  executionIntentSummaries: ExecutionIntent[];
  executionRequestSummaries: ExecutionRequestRecord[];
  feedbackLinkSummaries: ExecutionFeedbackLink[];
  status: MissionExecutionCoordinationStatusRecord;
  outcome: MissionExecutionCoordinationOutcomeRecord;
  priority: string;
  linkedActionItemIds: string[];
  linkedExecutionAttemptIds: string[];
  coordinationHistory: MissionExecutionCoordinationHistory;
  plan: MissionExecutionCoordinationPlan;
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}
