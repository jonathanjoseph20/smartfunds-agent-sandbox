export const CROSS_PORTFOLIO_MISSION_INTELLIGENCE_SET_TYPES = [
  'systemic_blocking_set',
  'shared_dependency_set',
  'governance_pattern_set',
  'resolution_regression_set',
  'mission_control_watch_set',
] as const;

export const CROSS_PORTFOLIO_SHARED_DEPENDENCY_CLASSES = [
  'shared_blocking_cluster',
  'shared_upstream_mission_dependency',
  'shared_governance_dependency',
  'shared_attention_dependency',
  'shared_resolution_dependency',
] as const;

export const SYSTEMIC_BLOCKING_CLUSTER_SEVERITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const CROSS_PORTFOLIO_ESCALATION_PATTERN_CLASSES = [
  'repeated_blocking_escalation',
  'repeated_governance_block',
  'repeated_resolution_regression',
  'critical_priority_concentration',
  'unresolved_attention_pattern',
  'systemic_inconclusive_pattern',
] as const;

export const MISSION_CONTROL_SYSTEMIC_RISK_POSTURES = [
  'clear',
  'degraded',
  'unstable',
  'critical',
  'blocked',
  'inconclusive',
] as const;

export const CROSS_PORTFOLIO_READINESS_POSTURES = [
  'not_ready',
  'partially_ready',
  'ready',
  'blocked',
  'degraded',
  'inconclusive',
] as const;

export const CROSS_PORTFOLIO_INTELLIGENCE_OUTCOMES = [
  'clear',
  'watch',
  'attention_required',
  'systemically_blocked',
  'systemically_unstable',
  'inconclusive',
] as const;

export const CROSS_PORTFOLIO_INTELLIGENCE_HISTORY_EVENT_TYPES = [
  'cross_portfolio_intelligence_set_created',
  'cross_portfolio_shared_dependency_detected',
  'cross_portfolio_blocking_cluster_detected',
  'cross_portfolio_escalation_pattern_detected',
  'cross_portfolio_risk_posture_updated',
  'cross_portfolio_readiness_updated',
  'cross_portfolio_materialized',
] as const;

export type CrossPortfolioMissionIntelligenceSetType = typeof CROSS_PORTFOLIO_MISSION_INTELLIGENCE_SET_TYPES[number];
export type CrossPortfolioSharedDependencyClass = typeof CROSS_PORTFOLIO_SHARED_DEPENDENCY_CLASSES[number];
export type SystemicBlockingClusterSeverity = typeof SYSTEMIC_BLOCKING_CLUSTER_SEVERITIES[number];
export type CrossPortfolioEscalationPatternClass = typeof CROSS_PORTFOLIO_ESCALATION_PATTERN_CLASSES[number];
export type MissionControlSystemicRiskPosture = typeof MISSION_CONTROL_SYSTEMIC_RISK_POSTURES[number];
export type CrossPortfolioReadinessPosture = typeof CROSS_PORTFOLIO_READINESS_POSTURES[number];
export type CrossPortfolioIntelligenceOutcome = typeof CROSS_PORTFOLIO_INTELLIGENCE_OUTCOMES[number];
export type CrossPortfolioIntelligenceHistoryEventType = typeof CROSS_PORTFOLIO_INTELLIGENCE_HISTORY_EVENT_TYPES[number];

export interface CrossPortfolioMembershipSummary {
  totalPortfolioCount: number;
  uniquePortfolioCount: number;
}

export interface CrossPortfolioSharedDependencySurface {
  crossPortfolioSharedDependencyId: string;
  crossPortfolioMissionIntelligenceSetId: string;
  portfolioIds: string[];
  dependencyClass: CrossPortfolioSharedDependencyClass;
  reasonTokens: string[];
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface SystemicBlockingCluster {
  systemicBlockingClusterId: string;
  crossPortfolioMissionIntelligenceSetId: string;
  portfolioIds: string[];
  portfolioBlockingClusterIds: string[];
  severity: SystemicBlockingClusterSeverity;
  reasonTokens: string[];
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface CrossPortfolioEscalationPattern {
  crossPortfolioEscalationPatternId: string;
  crossPortfolioMissionIntelligenceSetId: string;
  portfolioIds: string[];
  patternClass: CrossPortfolioEscalationPatternClass;
  severity: SystemicBlockingClusterSeverity;
  reasonTokens: string[];
  state: 'active' | 'resolved' | 'inconclusive';
}

export interface CrossPortfolioMissionIntelligenceSet {
  crossPortfolioMissionIntelligenceSetId: string;
  displayName: string;
  setType: CrossPortfolioMissionIntelligenceSetType;
  portfolioIds: string[];
  membershipSummary: CrossPortfolioMembershipSummary;
  systemicRiskPosture: MissionControlSystemicRiskPosture;
  readinessPosture: CrossPortfolioReadinessPosture;
  sharedDependencyIds: string[];
  systemicBlockingClusterIds: string[];
  escalationPatternIds: string[];
  intelligenceOutcome: CrossPortfolioIntelligenceOutcome;
}

export interface CrossPortfolioLinkedPortfolioSummary {
  missionPortfolioId: string;
  displayName: string;
  readinessState: string;
  healthState: string;
  governancePosture: string;
  attentionStatus: string;
  resolutionStatus: string;
  closureEligibility: string;
}

export interface CrossPortfolioPortfolioSignal {
  missionPortfolioId: string;
  displayName: string;
  readinessState: string;
  healthState: string;
  governancePosture: string;
  linkedBlockingClusterIds: string[];
  attentionStatus: string;
  attentionRequirementClasses: string[];
  openEscalationClasses: string[];
  openEscalationSeverities: string[];
  resolutionStatus: string;
  closureEligibility: string;
  closureState: string;
  resolutionOutcome: string;
  criticalMissionCount: number;
  highMissionCount: number;
  reasonTokens: string[];
}

export interface CrossPortfolioMissionIntelligenceProjection {
  crossPortfolioMissionIntelligenceSetId: string;
  displayName: string;
  setType: CrossPortfolioMissionIntelligenceSetType;
  portfolioIds: string[];
  membershipSummary: CrossPortfolioMembershipSummary;
  sharedDependencies: CrossPortfolioSharedDependencySurface[];
  systemicBlockingClusters: SystemicBlockingCluster[];
  escalationPatterns: CrossPortfolioEscalationPattern[];
  systemicRiskPosture: MissionControlSystemicRiskPosture;
  readinessPosture: CrossPortfolioReadinessPosture;
  intelligenceOutcome: CrossPortfolioIntelligenceOutcome;
  linkedPortfolioSummaries: CrossPortfolioLinkedPortfolioSummary[];
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}

export interface CrossPortfolioMissionIntelligenceHistoryEntry {
  crossPortfolioMissionIntelligenceSetId: string;
  eventType: CrossPortfolioIntelligenceHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface CrossPortfolioMissionIntelligenceHistory {
  crossPortfolioMissionIntelligenceSetId: string;
  entries: CrossPortfolioMissionIntelligenceHistoryEntry[];
}
