export const CROSS_SWARM_GROUP_TYPES = [
  'protocol_response_cluster',
  'governance_risk_cluster',
  'liquidity_instability_cluster',
  'market_shock_cluster'
] as const;

export const CROSS_SWARM_MATCH_DIMENSIONS = [
  'explicit_definition_match',
  'shared_team_ownership',
  'shared_protocol_family',
  'shared_asset_family',
  'shared_event_family',
  'shared_cohort_family'
] as const;

export const CROSS_SWARM_LIFECYCLE_STATES = [
  'inactive',
  'initializing',
  'active',
  'progressing',
  'stabilizing',
  'completed'
] as const;

export const CROSS_SWARM_READINESS_STATES = [
  'pending',
  'analyzing',
  'coherent',
  'blocked'
] as const;

export const CROSS_SWARM_HISTORY_EVENT_TYPES = [
  'cross_swarm_initialized',
  'swarm_linked',
  'readiness_changed',
  'coordination_progressed',
  'coordination_stabilized',
  'coordination_completed'
] as const;

export type CrossSwarmGroupType = typeof CROSS_SWARM_GROUP_TYPES[number];
export type CrossSwarmMatchDimension = typeof CROSS_SWARM_MATCH_DIMENSIONS[number];
export type CrossSwarmLifecycleState = typeof CROSS_SWARM_LIFECYCLE_STATES[number];
export type CrossSwarmReadinessState = typeof CROSS_SWARM_READINESS_STATES[number];
export type CrossSwarmHistoryEventType = typeof CROSS_SWARM_HISTORY_EVENT_TYPES[number];

export type CrossSwarmDefinition = {
  crossSwarmId: string;
  displayName: string;
  groupType: CrossSwarmGroupType;
  enabled: boolean;
  scope: {
    teamIds: string[];
    subjectKeys: string[];
  };
  include: {
    swarmIds: string[];
    teamIds: string[];
    protocolFamilies: string[];
    assetFamilies: string[];
    eventFamilies: string[];
    cohortFamilies: string[];
  };
  requiredMatchDimensions: CrossSwarmMatchDimension[];
  completionRules: {
    requireAllLinkedSwarmsComplete: boolean;
    requireNoBlockedSwarms: boolean;
    requireNoUnresolvedConflicts: boolean;
    requireCoherentReadiness: boolean;
  };
};

export type CrossSwarmLinkRationale = {
  dimension: CrossSwarmMatchDimension;
  reason: string;
};

export type CrossSwarmLinkedSwarm = {
  crossSwarmId: string;
  swarmId: string;
  teamId: string;
  swarmDisplayName: string;
  lifecycleState: CrossSwarmLifecycleState;
  readinessState: CrossSwarmReadinessState;
  completionSatisfied: boolean;
  unresolvedConflictCount: number;
  activeInvestigationCount: number;
  linkedInvestigationIds: string[];
  linkedSynthesisIds: string[];
  protocolFamilies: string[];
  assetFamilies: string[];
  eventFamilies: string[];
  cohortFamilies: string[];
  rationale: CrossSwarmLinkRationale[];
};

export type CrossSwarmCompletionEvaluation = {
  crossSwarmId: string;
  isComplete: boolean;
  unmetRequirements: string[];
  completedSwarmCount: number;
  totalSwarmCount: number;
  blockedSwarmCount: number;
  unresolvedConflictCount: number;
};

export type CrossSwarmStatusProjection = {
  crossSwarmId: string;
  displayName: string;
  groupType: CrossSwarmGroupType;
  enabled: boolean;
  linkedSwarmIds: string[];
  linkedSwarms: CrossSwarmLinkedSwarm[];
  lifecycleState: CrossSwarmLifecycleState;
  readinessState: CrossSwarmReadinessState;
  completion: CrossSwarmCompletionEvaluation;
  blockers: string[];
  conflicts: string[];
  strengths: string[];
  limitations: string[];
  rationale: string[];
};

export type CrossSwarmHistoryEntry = {
  crossSwarmId: string;
  eventType: CrossSwarmHistoryEventType;
  reason: string;
  eventDedupeKey: string;
  lifecycleState: CrossSwarmLifecycleState;
  readinessState: CrossSwarmReadinessState;
  completionSatisfied: boolean;
  linkedSwarmIds: string[];
  blockers: string[];
  conflicts: string[];
  slotReference?: string;
};

export type CrossSwarmHistory = {
  crossSwarmId: string;
  entries: CrossSwarmHistoryEntry[];
};

export type CrossSwarmProjection = CrossSwarmStatusProjection & {
  historySummary: {
    totalEvents: number;
    lastEventType?: CrossSwarmHistoryEventType;
    lastEventDedupeKey?: string;
  };
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    historyJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
  };
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
};

export class CrossSwarmError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CrossSwarmError';
    this.code = code;
  }
}
