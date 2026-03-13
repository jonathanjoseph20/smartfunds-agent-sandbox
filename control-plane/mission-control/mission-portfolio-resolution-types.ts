export const MISSION_PORTFOLIO_STABILIZATION_STATUSES = [
  'not_stable',
  'stabilizing',
  'stable',
  'regressed',
  'inconclusive',
] as const;

export const MISSION_PORTFOLIO_RESOLUTION_STATUSES = [
  'unresolved',
  'partially_resolved',
  'resolved',
  'reopened',
  'inconclusive',
] as const;

export const MISSION_PORTFOLIO_CLOSURE_ELIGIBILITY_STATUSES = [
  'not_closeable',
  'conditionally_closeable',
  'closeable',
  'blocked_from_closure',
  'inconclusive',
] as const;

export const MISSION_PORTFOLIO_RESOLUTION_QUEUE_STATES = [
  'queued',
  'awaiting_resolution_review',
  'under_resolution_review',
  'ready_to_close',
  'deferred',
  'closed',
] as const;

export const MISSION_PORTFOLIO_RESOLUTION_ACTION_TYPES = [
  'mark_stable',
  'mark_resolved',
  'close',
  'reopen',
  'archive',
  'defer_closure',
  'request_resolution_review',
] as const;

export const MISSION_PORTFOLIO_CLOSURE_STATES = [
  'open',
  'under_resolution_review',
  'ready_to_close',
  'closed',
  'reopened',
  'archived',
  'inconclusive',
] as const;

export const MISSION_PORTFOLIO_RESOLUTION_OUTCOMES = [
  'pending',
  'stabilized',
  'resolved',
  'deferred',
  'closed',
  'reopened',
  'archived',
  'inconclusive',
] as const;

export const MISSION_PORTFOLIO_RESOLUTION_ACTION_RECORD_STATES = [
  'recorded',
] as const;

export const MISSION_PORTFOLIO_RESOLUTION_HISTORY_EVENT_TYPES = [
  'portfolio_stabilization_detected',
  'portfolio_resolution_started',
  'portfolio_resolution_queued',
  'portfolio_marked_stable',
  'portfolio_marked_resolved',
  'portfolio_closure_deferred',
  'portfolio_closed',
  'portfolio_reopened',
  'portfolio_archived',
  'portfolio_resolution_closed',
] as const;

export type MissionPortfolioStabilizationStatus = typeof MISSION_PORTFOLIO_STABILIZATION_STATUSES[number];
export type MissionPortfolioResolutionStatus = typeof MISSION_PORTFOLIO_RESOLUTION_STATUSES[number];
export type MissionPortfolioClosureEligibility = typeof MISSION_PORTFOLIO_CLOSURE_ELIGIBILITY_STATUSES[number];
export type MissionPortfolioResolutionQueueState = typeof MISSION_PORTFOLIO_RESOLUTION_QUEUE_STATES[number];
export type MissionPortfolioResolutionActionType = typeof MISSION_PORTFOLIO_RESOLUTION_ACTION_TYPES[number];
export type MissionPortfolioClosureState = typeof MISSION_PORTFOLIO_CLOSURE_STATES[number];
export type MissionPortfolioResolutionOutcome = typeof MISSION_PORTFOLIO_RESOLUTION_OUTCOMES[number];
export type MissionPortfolioResolutionActionRecordState = typeof MISSION_PORTFOLIO_RESOLUTION_ACTION_RECORD_STATES[number];
export type MissionPortfolioResolutionHistoryEventType = typeof MISSION_PORTFOLIO_RESOLUTION_HISTORY_EVENT_TYPES[number];

export interface MissionPortfolioStabilization {
  portfolioStabilizationId: string;
  missionPortfolioId: string;
  stabilizationStatus: MissionPortfolioStabilizationStatus;
  reasonTokens: string[];
  linkedAttentionRequirementIds: string[];
  linkedEscalationIds: string[];
  linkedBlockingClusterIds: string[];
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface MissionPortfolioResolutionStatusRecord {
  portfolioResolutionStatusId: string;
  missionPortfolioId: string;
  resolutionStatus: MissionPortfolioResolutionStatus;
  reasonTokens: string[];
  linkedActionRecordIds: string[];
  linkedRequirementIds: string[];
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface MissionPortfolioClosureEligibilityRecord {
  portfolioClosureEligibilityId: string;
  missionPortfolioId: string;
  closureEligibility: MissionPortfolioClosureEligibility;
  reasonTokens: string[];
  unresolvedRequirementCount: number;
  openEscalationCount: number;
  blockingClusterCount: number;
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface MissionPortfolioResolutionQueueEntry {
  portfolioResolutionQueueEntryId: string;
  missionPortfolioId: string;
  resolutionStatus: MissionPortfolioResolutionStatus;
  closureEligibility: MissionPortfolioClosureEligibility;
  priority: number;
  queueState: MissionPortfolioResolutionQueueState;
  reasonTokens: string[];
}

export interface PortfolioResolutionActionRecord {
  portfolioResolutionActionRecordId: string;
  missionPortfolioId: string;
  portfolioResolutionQueueEntryId: string;
  actionType: MissionPortfolioResolutionActionType;
  reasonTokens: string[];
  linkedRequirementIds: string[];
  linkedEscalationIds: string[];
  actionOutcome: MissionPortfolioResolutionOutcome;
  actor: 'operator';
  state: MissionPortfolioResolutionActionRecordState;
}

export interface MissionPortfolioResolutionHistoryEntry {
  missionPortfolioId: string;
  eventType: MissionPortfolioResolutionHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface MissionPortfolioResolutionHistory {
  missionPortfolioId: string;
  entries: MissionPortfolioResolutionHistoryEntry[];
}

export interface MissionPortfolioResolutionProjection {
  missionPortfolioId: string;
  portfolioResolutionQueueEntryId: string | null;
  stabilizationStatus: MissionPortfolioStabilizationStatus;
  resolutionStatus: MissionPortfolioResolutionStatus;
  closureEligibility: MissionPortfolioClosureEligibility;
  closureState: MissionPortfolioClosureState;
  resolutionOutcome: MissionPortfolioResolutionOutcome;
  linkedBlockingClusters: string[];
  linkedEscalations: string[];
  activeResolutionActionRecordId: string | null;
  resolutionActionHistory: MissionPortfolioResolutionHistoryEntry[];
  stabilization: MissionPortfolioStabilization;
  resolution: MissionPortfolioResolutionStatusRecord;
  closureEligibilityRecord: MissionPortfolioClosureEligibilityRecord;
  queueEntry: MissionPortfolioResolutionQueueEntry | null;
  actionRecords: PortfolioResolutionActionRecord[];
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}
