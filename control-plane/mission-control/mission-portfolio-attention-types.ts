import type { MissionPortfolioPriorityDistribution } from './mission-portfolio-types.ts';

export const MISSION_PORTFOLIO_ATTENTION_REQUIREMENT_CLASSES = [
  'critical_blocking_cluster',
  'governance_mixed_attention',
  'critical_priority_attention',
  'degraded_health_attention',
  'failed_member_attention',
  'operator_forced_attention',
  'inconclusive_attention',
] as const;

export const MISSION_PORTFOLIO_ESCALATION_CLASSES = [
  'portfolio_blocked',
  'portfolio_unstable',
  'portfolio_governance_blocked',
  'portfolio_critical_overload',
  'portfolio_priority_conflict',
  'portfolio_inconclusive',
] as const;

export const MISSION_PORTFOLIO_ESCALATION_SEVERITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const MISSION_PORTFOLIO_ATTENTION_STATUSES = [
  'no_attention_required',
  'awaiting_attention',
  'under_attention',
  'acknowledged',
  'deferred',
  'escalated',
  'suppressed',
  'inconclusive',
] as const;

export const MISSION_PORTFOLIO_ACTION_TYPES = [
  'acknowledge',
  'defer',
  'escalate',
  'force_review',
  'suppress',
  'request_portfolio_review',
] as const;

export const MISSION_PORTFOLIO_ACTION_OUTCOMES = [
  'pending',
  'acknowledged',
  'deferred',
  'escalated',
  'suppressed',
  'review_requested',
  'inconclusive',
] as const;

export const MISSION_PORTFOLIO_ESCALATION_STATES = [
  'open',
  'acknowledged',
  'suppressed',
  'resolved',
] as const;

export const MISSION_PORTFOLIO_ATTENTION_QUEUE_STATES = [
  'queued',
  'awaiting_attention',
  'under_attention',
  'action_recorded',
  'deferred',
  'closed',
] as const;

export const PORTFOLIO_OPERATOR_ACTION_RECORD_STATES = [
  'recorded',
] as const;

export const MISSION_PORTFOLIO_ATTENTION_HISTORY_EVENT_TYPES = [
  'portfolio_attention_required',
  'portfolio_escalation_opened',
  'portfolio_attention_queued',
  'portfolio_attention_acknowledged',
  'portfolio_attention_deferred',
  'portfolio_attention_escalated',
  'portfolio_attention_suppressed',
  'portfolio_operator_action_recorded',
  'portfolio_attention_closed',
] as const;

export type MissionPortfolioAttentionRequirementClass = typeof MISSION_PORTFOLIO_ATTENTION_REQUIREMENT_CLASSES[number];
export type MissionPortfolioEscalationClass = typeof MISSION_PORTFOLIO_ESCALATION_CLASSES[number];
export type MissionPortfolioEscalationSeverity = typeof MISSION_PORTFOLIO_ESCALATION_SEVERITIES[number];
export type MissionPortfolioAttentionStatus = typeof MISSION_PORTFOLIO_ATTENTION_STATUSES[number];
export type MissionPortfolioActionType = typeof MISSION_PORTFOLIO_ACTION_TYPES[number];
export type MissionPortfolioActionOutcome = typeof MISSION_PORTFOLIO_ACTION_OUTCOMES[number];
export type MissionPortfolioEscalationState = typeof MISSION_PORTFOLIO_ESCALATION_STATES[number];
export type MissionPortfolioAttentionQueueState = typeof MISSION_PORTFOLIO_ATTENTION_QUEUE_STATES[number];
export type PortfolioOperatorActionRecordState = typeof PORTFOLIO_OPERATOR_ACTION_RECORD_STATES[number];
export type MissionPortfolioAttentionHistoryEventType = typeof MISSION_PORTFOLIO_ATTENTION_HISTORY_EVENT_TYPES[number];

export interface MissionPortfolioAttentionRequirement {
  portfolioAttentionRequirementId: string;
  missionPortfolioId: string;
  requirementClass: MissionPortfolioAttentionRequirementClass;
  severity: MissionPortfolioEscalationSeverity;
  reasonTokens: string[];
  linkedBlockingClusterIds: string[];
  linkedMissionRunIds: string[];
  linkedDecisionIds: string[];
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface MissionPortfolioEscalation {
  portfolioEscalationId: string;
  missionPortfolioId: string;
  escalationClass: MissionPortfolioEscalationClass;
  severity: MissionPortfolioEscalationSeverity;
  reasonTokens: string[];
  linkedRequirementIds: string[];
  linkedMissionRunIds: string[];
  state: MissionPortfolioEscalationState;
}

export interface MissionPortfolioAttentionQueueEntry {
  portfolioAttentionQueueEntryId: string;
  missionPortfolioId: string;
  attentionStatus: MissionPortfolioAttentionStatus;
  requirementClass: MissionPortfolioAttentionRequirementClass | null;
  escalationClass: MissionPortfolioEscalationClass | null;
  priority: number;
  queueState: MissionPortfolioAttentionQueueState;
  reasonTokens: string[];
}

export interface PortfolioOperatorActionRecord {
  portfolioOperatorActionRecordId: string;
  missionPortfolioId: string;
  portfolioAttentionQueueEntryId: string;
  actionType: MissionPortfolioActionType;
  reasonTokens: string[];
  linkedEscalationIds: string[];
  linkedRequirementIds: string[];
  actionOutcome: Exclude<MissionPortfolioActionOutcome, 'pending'>;
  state: PortfolioOperatorActionRecordState;
}

export interface MissionPortfolioAttentionHistoryEntry {
  missionPortfolioId: string;
  eventType: MissionPortfolioAttentionHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface MissionPortfolioAttentionHistory {
  missionPortfolioId: string;
  entries: MissionPortfolioAttentionHistoryEntry[];
}

export interface MissionPortfolioAttentionProjection {
  missionPortfolioId: string;
  portfolioAttentionQueueEntryId: string | null;
  attentionStatus: MissionPortfolioAttentionStatus;
  activeRequirementClasses: MissionPortfolioAttentionRequirementClass[];
  escalationSummaries: Array<{
    portfolioEscalationId: string;
    escalationClass: MissionPortfolioEscalationClass;
    severity: MissionPortfolioEscalationSeverity;
    state: MissionPortfolioEscalationState;
  }>;
  actionOutcome: MissionPortfolioActionOutcome;
  priorityDistribution: MissionPortfolioPriorityDistribution;
  linkedBlockingClusters: string[];
  linkedMissionEscalations: Array<{
    missionRunId: string;
    escalationId: string;
    escalationClass: string;
    severity: string;
    state: string;
  }>;
  activeActionRecordId: string | null;
  actionHistory: MissionPortfolioAttentionHistoryEntry[];
  attentionRequirements: MissionPortfolioAttentionRequirement[];
  escalations: MissionPortfolioEscalation[];
  queueEntry: MissionPortfolioAttentionQueueEntry | null;
  actionRecords: PortfolioOperatorActionRecord[];
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}
