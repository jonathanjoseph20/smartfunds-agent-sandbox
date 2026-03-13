import {
  deriveSystemicStabilizationStrategyId,
  uniqueSortedStrings,
} from './mission-control-orchestration-identity.ts';
import type {
  CrossPortfolioMissionIntelligenceProjection,
} from './cross-portfolio-mission-intelligence-types.ts';
import type {
  MissionControlOrchestrationPriority,
  SystemicStabilizationStrategy,
  SystemicStabilizationStrategyClass,
} from './mission-control-orchestration-types.ts';

export function deriveSystemicStabilizationStrategyClass(input: {
  projection: CrossPortfolioMissionIntelligenceProjection;
  priority: MissionControlOrchestrationPriority;
}): SystemicStabilizationStrategyClass {
  if (input.projection.intelligenceOutcome === 'inconclusive') {
    return 'systemic_watch_strategy';
  }

  if (
    input.projection.systemicRiskPosture === 'blocked'
    || input.projection.intelligenceOutcome === 'systemically_blocked'
  ) {
    return 'dependency_relief_strategy';
  }

  if (
    input.projection.escalationPatterns.some((entry) => entry.patternClass === 'repeated_governance_block')
  ) {
    return 'governance_resolution_strategy';
  }

  if (input.projection.systemicBlockingClusters.length > 0) {
    return 'blocking_cluster_reduction_strategy';
  }

  if (input.priority === 'critical' || input.priority === 'high') {
    return 'critical_priority_stabilization_strategy';
  }

  if (input.projection.intelligenceOutcome === 'attention_required' || input.projection.intelligenceOutcome === 'systemically_unstable') {
    return 'resolution_recovery_strategy';
  }

  return 'systemic_watch_strategy';
}

export function deriveSystemicStabilizationStrategy(input: {
  missionControlInterventionPlanId: string;
  projection: CrossPortfolioMissionIntelligenceProjection;
  strategyClass: SystemicStabilizationStrategyClass;
  priority: MissionControlOrchestrationPriority;
}): SystemicStabilizationStrategy {
  const linkedDependencyIds = uniqueSortedStrings(input.projection.sharedDependencies.map((entry) => entry.crossPortfolioSharedDependencyId));
  const linkedBlockingClusterIds = uniqueSortedStrings(input.projection.systemicBlockingClusters.map((entry) => entry.systemicBlockingClusterId));
  const linkedEscalationPatternIds = uniqueSortedStrings(input.projection.escalationPatterns.map((entry) => entry.crossPortfolioEscalationPatternId));

  const reasonTokens = uniqueSortedStrings([
    `strategy_class:${input.strategyClass}`,
    `priority:${input.priority}`,
    `systemic_risk_posture:${input.projection.systemicRiskPosture}`,
    `readiness_posture:${input.projection.readinessPosture}`,
    `intelligence_outcome:${input.projection.intelligenceOutcome}`,
    ...linkedDependencyIds.map((entry) => `dependency:${entry}`),
    ...linkedBlockingClusterIds.map((entry) => `blocking_cluster:${entry}`),
    ...linkedEscalationPatternIds.map((entry) => `escalation_pattern:${entry}`),
  ]);

  const state: SystemicStabilizationStrategy['state'] = input.projection.intelligenceOutcome === 'inconclusive'
    ? 'inconclusive'
    : (input.priority === 'deferred' ? 'deferred' : 'active');

  return {
    systemicStabilizationStrategyId: deriveSystemicStabilizationStrategyId({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      strategyClass: input.strategyClass,
      reasonTokens,
      linkedDependencyIds,
      linkedBlockingClusterIds,
      linkedEscalationPatternIds,
    }),
    missionControlInterventionPlanId: input.missionControlInterventionPlanId,
    strategyClass: input.strategyClass,
    reasonTokens,
    linkedDependencyIds,
    linkedBlockingClusterIds,
    linkedEscalationPatternIds,
    state,
  };
}
