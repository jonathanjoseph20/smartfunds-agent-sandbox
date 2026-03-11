export const TEAM_RESPONSE_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;

export type TeamResponsePriority = typeof TEAM_RESPONSE_PRIORITIES[number];

export const TEAM_READINESS_STATES = ['ready', 'engaged', 'stabilizing', 'resolved', 'blocked'] as const;

export type TeamReadinessState = typeof TEAM_READINESS_STATES[number];

export const TEAM_STABILIZATION_STATES = ['stabilizing', 'resolved'] as const;

export type TeamStabilizationState = typeof TEAM_STABILIZATION_STATES[number];

export const TEAM_COORDINATION_EVENT_TYPES = [
  'investigation_routed',
  'response_priority_changed',
  'response_stabilizing',
  'response_resolved'
] as const;

export type TeamCoordinationEventType = typeof TEAM_COORDINATION_EVENT_TYPES[number];

export type TeamRoutingRule = {
  cohort: string;
  investigationTemplate: string;
};

export type TeamStabilizationRules = {
  requiredHealthySlots: number;
  requireResolvedInvestigations: boolean;
  requireClearedConflicts: boolean;
};

export type TeamPriorityRules = {
  escalated: TeamResponsePriority;
  conflicted: TeamResponsePriority;
  failure: TeamResponsePriority;
};

export type TeamResponsePolicy = {
  teamId: string;
  routingRules: TeamRoutingRule[];
  priorityRules: TeamPriorityRules;
  stabilizationRules: TeamStabilizationRules;
};

export type TeamRoutingDecision = {
  teamId: string;
  investigationTemplate: string;
  matchedCohortId: string;
  reason: string;
};

export type TeamPriorityEvaluation = {
  teamId: string;
  priority: TeamResponsePriority;
  reasons: string[];
  appliedRule: 'conflicted' | 'escalated' | 'failure' | 'signal_severity' | 'default';
};

export type TeamStabilizationEvaluation = {
  teamId: string;
  stabilizationState: TeamStabilizationState;
  healthySlotCount: number;
  unresolvedInvestigationCount: number;
  synthesisConflictCount: number;
  reasons: string[];
};

export type TeamReadinessEvaluation = {
  teamId: string;
  readiness: TeamReadinessState;
  reasons: string[];
};

export type TeamCoordinationEvent = {
  eventType: TeamCoordinationEventType;
  teamId: string;
  linkedCohortIds: string[];
  linkedInvestigationIds: string[];
  priority: TeamResponsePriority;
  readiness: TeamReadinessState;
  stabilizationState: TeamStabilizationState;
  reason: string;
  eventDedupeKey: string;
  slotReference?: string;
  routedInvestigationTemplate?: string;
  healthySlotCount?: number;
};

export type TeamCoordinationHistory = {
  teamId: string;
  entries: TeamCoordinationEvent[];
};

export type TeamCoordinationProjection = {
  teamId: string;
  priority: TeamResponsePriority;
  readiness: TeamReadinessState;
  stabilizationState: TeamStabilizationState;
  activeInvestigations: string[];
  linkedCohortIds: string[];
  healthySlotCount: number;
  lastEventType: TeamCoordinationEventType | null;
};

export class TeamCoordinationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TeamCoordinationError';
    this.code = code;
  }
}
