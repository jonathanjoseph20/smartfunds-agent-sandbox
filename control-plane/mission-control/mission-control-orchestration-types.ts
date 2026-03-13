import type {
  CrossPortfolioReadinessPosture,
  MissionControlSystemicRiskPosture,
  SystemicBlockingClusterSeverity,
} from './cross-portfolio-mission-intelligence-types.ts';

export const MISSION_CONTROL_ORCHESTRATION_PLAN_STATES = [
  'created',
  'queued',
  'active',
  'deferred',
  'completed',
  'blocked',
  'inconclusive',
] as const;

export const SYSTEMIC_STABILIZATION_STRATEGY_CLASSES = [
  'dependency_relief_strategy',
  'governance_resolution_strategy',
  'blocking_cluster_reduction_strategy',
  'critical_priority_stabilization_strategy',
  'resolution_recovery_strategy',
  'systemic_watch_strategy',
] as const;

export const MISSION_CONTROL_ORCHESTRATION_ACTION_CLASSES = [
  'request_portfolio_review',
  'prioritize_portfolio_attention',
  'defer_noncritical_portfolio',
  'stabilize_blocking_cluster',
  'escalate_systemic_condition',
  'request_resolution_reassessment',
  'maintain_watch_state',
] as const;

export const MISSION_CONTROL_ORCHESTRATION_ACTION_STATES = [
  'pending',
  'active',
  'deferred',
  'completed',
  'blocked',
  'inconclusive',
] as const;

export const MISSION_CONTROL_ORCHESTRATION_QUEUE_STATES = [
  'queued',
  'awaiting_orchestration',
  'under_orchestration',
  'deferred',
  'closed',
  'blocked',
] as const;

export const MISSION_CONTROL_ORCHESTRATION_PRIORITIES = [
  'critical',
  'high',
  'normal',
  'low',
  'deferred',
] as const;

export const MISSION_CONTROL_ORCHESTRATION_OUTCOMES = [
  'pending',
  'active',
  'stabilizing',
  'deferred',
  'completed',
  'blocked',
  'inconclusive',
] as const;

export const MISSION_CONTROL_ORCHESTRATION_HISTORY_EVENT_TYPES = [
  'mission_control_intervention_plan_created',
  'mission_control_orchestration_queued',
  'mission_control_orchestration_started',
  'mission_control_action_item_created',
  'mission_control_action_item_deferred',
  'mission_control_action_item_completed',
  'mission_control_orchestration_blocked',
  'mission_control_orchestration_completed',
  'mission_control_materialized',
] as const;

export type MissionControlOrchestrationPlanState = typeof MISSION_CONTROL_ORCHESTRATION_PLAN_STATES[number];
export type SystemicStabilizationStrategyClass = typeof SYSTEMIC_STABILIZATION_STRATEGY_CLASSES[number];
export type MissionControlOrchestrationActionClass = typeof MISSION_CONTROL_ORCHESTRATION_ACTION_CLASSES[number];
export type MissionControlOrchestrationActionState = typeof MISSION_CONTROL_ORCHESTRATION_ACTION_STATES[number];
export type MissionControlOrchestrationQueueState = typeof MISSION_CONTROL_ORCHESTRATION_QUEUE_STATES[number];
export type MissionControlOrchestrationPriority = typeof MISSION_CONTROL_ORCHESTRATION_PRIORITIES[number];
export type MissionControlOrchestrationOutcome = typeof MISSION_CONTROL_ORCHESTRATION_OUTCOMES[number];
export type MissionControlOrchestrationHistoryEventType = typeof MISSION_CONTROL_ORCHESTRATION_HISTORY_EVENT_TYPES[number];

export interface MissionControlInterventionPlan {
  missionControlInterventionPlanId: string;
  crossPortfolioMissionIntelligenceSetId: string;
  displayName: string;
  strategyClass: SystemicStabilizationStrategyClass;
  portfolioIds: string[];
  systemicBlockingClusterIds: string[];
  escalationPatternIds: string[];
  actionItemIds: string[];
  priority: MissionControlOrchestrationPriority;
  outcome: MissionControlOrchestrationOutcome;
  state: MissionControlOrchestrationPlanState;
}

export interface SystemicStabilizationStrategy {
  systemicStabilizationStrategyId: string;
  missionControlInterventionPlanId: string;
  strategyClass: SystemicStabilizationStrategyClass;
  reasonTokens: string[];
  linkedDependencyIds: string[];
  linkedBlockingClusterIds: string[];
  linkedEscalationPatternIds: string[];
  state: 'active' | 'deferred' | 'completed' | 'blocked' | 'inconclusive';
}

export interface MissionControlOrchestrationActionItem {
  missionControlOrchestrationActionItemId: string;
  missionControlInterventionPlanId: string;
  actionClass: MissionControlOrchestrationActionClass;
  priority: MissionControlOrchestrationPriority;
  reasonTokens: string[];
  linkedPortfolioIds: string[];
  linkedRequirementIds: string[];
  linkedEscalationPatternIds: string[];
  state: MissionControlOrchestrationActionState;
}

export interface MissionControlOrchestrationQueueEntry {
  missionControlOrchestrationQueueEntryId: string;
  missionControlInterventionPlanId: string;
  priority: MissionControlOrchestrationPriority;
  queueState: MissionControlOrchestrationQueueState;
  reasonTokens: string[];
  linkedPortfolioIds: string[];
  linkedBlockingClusterIds: string[];
  state: MissionControlOrchestrationPlanState;
}

export interface MissionControlOrchestrationPriorityPosture {
  missionControlInterventionPlanId: string;
  priority: MissionControlOrchestrationPriority;
  systemicRiskPosture: MissionControlSystemicRiskPosture;
  readinessPosture: CrossPortfolioReadinessPosture;
  highestBlockingSeverity: SystemicBlockingClusterSeverity | 'none';
  highestEscalationSeverity: SystemicBlockingClusterSeverity | 'none';
  reasonTokens: string[];
}

export interface MissionControlOrchestrationOutcomeRecord {
  missionControlInterventionPlanId: string;
  outcome: MissionControlOrchestrationOutcome;
  reasonTokens: string[];
}

export interface MissionControlOrchestrationHistoryEntry {
  missionControlInterventionPlanId: string;
  eventType: MissionControlOrchestrationHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface MissionControlOrchestrationHistory {
  missionControlInterventionPlanId: string;
  entries: MissionControlOrchestrationHistoryEntry[];
}

export interface MissionControlOrchestrationProjection {
  missionControlInterventionPlanId: string;
  crossPortfolioMissionIntelligenceSetId: string;
  displayName: string;
  interventionPlan: MissionControlInterventionPlan;
  stabilizationStrategy: SystemicStabilizationStrategy;
  actionItems: MissionControlOrchestrationActionItem[];
  orchestrationQueue: MissionControlOrchestrationQueueEntry | null;
  priorityPosture: MissionControlOrchestrationPriorityPosture;
  orchestrationOutcome: MissionControlOrchestrationOutcomeRecord;
  orchestrationHistory: MissionControlOrchestrationHistory;
  orchestrationHistorySummary: {
    totalEvents: number;
    lastEventType: MissionControlOrchestrationHistoryEventType | null;
  };
  interventionPlanPosture: {
    state: MissionControlOrchestrationPlanState;
    priority: MissionControlOrchestrationPriority;
    outcome: MissionControlOrchestrationOutcome;
  };
  stabilizationStrategySummary: {
    strategyClass: SystemicStabilizationStrategyClass;
    state: SystemicStabilizationStrategy['state'];
    reasonTokens: string[];
  };
  actionItemStates: Array<{
    missionControlOrchestrationActionItemId: string;
    actionClass: MissionControlOrchestrationActionClass;
    state: MissionControlOrchestrationActionState;
    priority: MissionControlOrchestrationPriority;
  }>;
  queueStateSummary: {
    queueState: MissionControlOrchestrationQueueState | null;
    state: MissionControlOrchestrationPlanState;
  };
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}
