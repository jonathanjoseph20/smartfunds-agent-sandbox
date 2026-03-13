import type { MissionCoordinationProjection, MissionPriorityLevel } from './mission-coordination.ts';

export const MISSION_REVIEW_QUEUE_STATES = [
  'queued',
  'awaiting_review',
  'under_review',
  'decision_recorded',
  'deferred',
  'closed',
] as const;

export const MISSION_GOVERNANCE_STATUSES = [
  'no_review_required',
  'awaiting_review',
  'under_review',
  'approved',
  'rejected',
  'deferred',
  'escalated_for_decision',
  'changes_requested',
  'inconclusive',
] as const;

export const MISSION_REVIEW_REQUIREMENT_CLASSES = [
  'critical_escalation_review',
  'dependency_resolution_review',
  'operator_forced_review',
  'priority_review',
  'changes_requested_review',
  'completion_review',
  'inconclusive_review',
] as const;

export const MISSION_DECISION_TYPES = [
  'approve',
  'reject',
  'defer',
  'request_changes',
  'force_review',
  'escalate',
] as const;

export const MISSION_DECISION_OUTCOMES = [
  'pending',
  'approved',
  'rejected',
  'deferred',
  'changes_requested',
  'review_escalated',
  'inconclusive',
] as const;

export const MISSION_DECISION_RECORD_STATES = [
  'recorded',
] as const;

export const MISSION_REVIEW_HISTORY_EVENT_TYPES = [
  'mission_review_queued',
  'mission_review_started',
  'mission_review_deferred',
  'mission_decision_recorded',
  'mission_approved',
  'mission_rejected',
  'mission_changes_requested',
  'mission_review_escalated',
  'mission_review_closed',
] as const;

export type MissionReviewQueueState = typeof MISSION_REVIEW_QUEUE_STATES[number];
export type MissionGovernanceStatus = typeof MISSION_GOVERNANCE_STATUSES[number];
export type MissionReviewRequirementClass = typeof MISSION_REVIEW_REQUIREMENT_CLASSES[number];
export type MissionDecisionType = typeof MISSION_DECISION_TYPES[number];
export type MissionDecisionOutcome = typeof MISSION_DECISION_OUTCOMES[number];
export type OperatorDecisionRecordState = typeof MISSION_DECISION_RECORD_STATES[number];
export type MissionReviewHistoryEventType = typeof MISSION_REVIEW_HISTORY_EVENT_TYPES[number];

export interface MissionReviewRequirement {
  missionRunId: string;
  reviewRequirementClass: MissionReviewRequirementClass;
  reasonTokens: string[];
  linkedEscalationIds: string[];
  linkedDependencyIds: string[];
  priority: MissionPriorityLevel;
}

export interface MissionReviewQueueEntry {
  reviewQueueEntryId: string;
  missionRunId: string;
  reviewRequirementClass: MissionReviewRequirementClass;
  governanceStatus: MissionGovernanceStatus;
  priority: MissionPriorityLevel;
  queueState: MissionReviewQueueState;
  reasonTokens: string[];
  linkedEscalationIds: string[];
  linkedDependencyIds: string[];
}

export interface OperatorDecisionRecord {
  decisionRecordId: string;
  missionRunId: string;
  reviewQueueEntryId: string;
  decisionType: MissionDecisionType;
  decisionOutcome: Exclude<MissionDecisionOutcome, 'pending'>;
  reasonTokens: string[];
  linkedEscalationIds: string[];
  linkedInterventionIds: string[];
  state: OperatorDecisionRecordState;
}

export interface MissionReviewHistoryEntry {
  missionRunId: string;
  eventType: MissionReviewHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface MissionReviewHistory {
  missionRunId: string;
  entries: MissionReviewHistoryEntry[];
}

export interface MissionReviewProjection {
  missionRunId: string;
  reviewQueueEntryId: string | null;
  governanceStatus: MissionGovernanceStatus;
  reviewRequirementClass: MissionReviewRequirementClass | null;
  decisionOutcome: MissionDecisionOutcome;
  priority: MissionPriorityLevel;
  activeDecisionRecordId: string | null;
  decisionHistory: MissionReviewHistoryEntry[];
  linkedEscalations: string[];
  linkedDependencies: string[];
  queueState: MissionReviewQueueState | null;
  coordination: MissionCoordinationProjection;
  reviewRequirements: MissionReviewRequirement[];
  queueEntry: MissionReviewQueueEntry | null;
  decisionRecords: OperatorDecisionRecord[];
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}
