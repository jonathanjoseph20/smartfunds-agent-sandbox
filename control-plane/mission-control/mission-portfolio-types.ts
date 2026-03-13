export const MISSION_PORTFOLIO_TYPES = [
  'objective_portfolio',
  'coordination_portfolio',
  'dependency_cluster_portfolio',
  'governance_track_portfolio',
  'operating_domain_portfolio',
] as const;

export const MISSION_PORTFOLIO_MEMBERSHIP_CLASSES = [
  'shared_objective',
  'shared_dependency_chain',
  'shared_governance_track',
  'shared_priority_band',
  'explicit_portfolio_membership',
  'shared_operating_domain',
] as const;

export const MISSION_PORTFOLIO_MEMBERSHIP_STATES = [
  'active',
  'inactive',
] as const;

export const MISSION_PORTFOLIO_READINESS_STATES = [
  'not_ready',
  'partially_ready',
  'ready',
  'blocked',
  'degraded',
  'inconclusive',
] as const;

export const MISSION_PORTFOLIO_HEALTH_STATES = [
  'healthy',
  'degraded',
  'unstable',
  'blocked',
  'failed',
  'inconclusive',
] as const;

export const MISSION_PORTFOLIO_GOVERNANCE_POSTURES = [
  'clear',
  'awaiting_reviews',
  'decision_blocked',
  'deferred',
  'mixed',
  'inconclusive',
] as const;

export const PORTFOLIO_BLOCKING_CLUSTER_SEVERITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const PORTFOLIO_BLOCKING_CLUSTER_STATES = [
  'active',
  'resolved',
] as const;

export const MISSION_PORTFOLIO_HISTORY_EVENT_TYPES = [
  'mission_portfolio_created',
  'mission_portfolio_membership_added',
  'mission_portfolio_membership_removed',
  'mission_portfolio_blocking_detected',
  'mission_portfolio_blocking_resolved',
  'mission_portfolio_governance_updated',
  'mission_portfolio_readiness_updated',
  'mission_portfolio_materialized',
] as const;

export type MissionPortfolioType = typeof MISSION_PORTFOLIO_TYPES[number];
export type MissionPortfolioMembershipClass = typeof MISSION_PORTFOLIO_MEMBERSHIP_CLASSES[number];
export type MissionPortfolioMembershipState = typeof MISSION_PORTFOLIO_MEMBERSHIP_STATES[number];
export type MissionPortfolioReadinessState = typeof MISSION_PORTFOLIO_READINESS_STATES[number];
export type MissionPortfolioHealthState = typeof MISSION_PORTFOLIO_HEALTH_STATES[number];
export type MissionPortfolioGovernancePosture = typeof MISSION_PORTFOLIO_GOVERNANCE_POSTURES[number];
export type PortfolioBlockingClusterSeverity = typeof PORTFOLIO_BLOCKING_CLUSTER_SEVERITIES[number];
export type PortfolioBlockingClusterState = typeof PORTFOLIO_BLOCKING_CLUSTER_STATES[number];
export type MissionPortfolioHistoryEventType = typeof MISSION_PORTFOLIO_HISTORY_EVENT_TYPES[number];

export interface MissionPortfolioMembership {
  missionPortfolioMembershipId: string;
  missionPortfolioId: string;
  missionRunId: string;
  membershipClass: MissionPortfolioMembershipClass;
  reasonTokens: string[];
  state: MissionPortfolioMembershipState;
}

export interface PortfolioBlockingCluster {
  portfolioBlockingClusterId: string;
  missionPortfolioId: string;
  blockingMissionRunIds: string[];
  blockedMissionRunIds: string[];
  reasonTokens: string[];
  severity: PortfolioBlockingClusterSeverity;
  state: PortfolioBlockingClusterState;
}

export interface MissionPortfolioPriorityDistribution {
  criticalMissionCount: number;
  highMissionCount: number;
  normalMissionCount: number;
  lowMissionCount: number;
  deferredMissionCount: number;
  posture: 'priority_balanced' | 'priority_skewed' | 'critical_overload' | 'deferred_heavy';
}

export interface MissionPortfolioMembershipSummary {
  totalMembershipCount: number;
  activeMembershipCount: number;
  membershipClassCounts: Record<MissionPortfolioMembershipClass, number>;
}

export interface MissionPortfolio {
  missionPortfolioId: string;
  displayName: string;
  portfolioType: MissionPortfolioType;
  missionRunIds: string[];
  membershipSummary: MissionPortfolioMembershipSummary;
  priorityDistribution: MissionPortfolioPriorityDistribution;
  governancePosture: MissionPortfolioGovernancePosture;
  readinessState: MissionPortfolioReadinessState;
  healthState: MissionPortfolioHealthState;
  blockingClusterIds: string[];
}

export interface MissionPortfolioHistoryEntry {
  missionPortfolioId: string;
  eventType: MissionPortfolioHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface MissionPortfolioHistory {
  missionPortfolioId: string;
  entries: MissionPortfolioHistoryEntry[];
}

export interface MissionPortfolioProjection {
  missionPortfolioId: string;
  displayName: string;
  portfolioType: MissionPortfolioType;
  missionRunIds: string[];
  memberships: MissionPortfolioMembership[];
  membershipSummaries: MissionPortfolioMembershipSummary;
  readinessState: MissionPortfolioReadinessState;
  healthState: MissionPortfolioHealthState;
  governancePosture: MissionPortfolioGovernancePosture;
  priorityDistribution: MissionPortfolioPriorityDistribution;
  blockingClusters: PortfolioBlockingCluster[];
  linkedEscalationSummaries: Array<{
    missionRunId: string;
    escalationId: string;
    escalationClass: string;
    severity: string;
    state: string;
  }>;
  linkedDecisionSummaries: Array<{
    missionRunId: string;
    decisionRecordId: string;
    decisionOutcome: string;
    governanceStatus: string;
  }>;
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}

export interface MissionPortfolioDefinition {
  missionPortfolioId: string;
  displayName: string;
  portfolioType: MissionPortfolioType;
}
