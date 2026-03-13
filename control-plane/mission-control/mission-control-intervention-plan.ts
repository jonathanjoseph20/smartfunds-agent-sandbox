import {
  deriveMissionControlInterventionPlanId,
  uniqueSortedStrings,
} from './mission-control-orchestration-identity.ts';
import type {
  CrossPortfolioMissionIntelligenceProjection,
} from './cross-portfolio-mission-intelligence-types.ts';
import type {
  MissionControlInterventionPlan,
  MissionControlOrchestrationOutcome,
  MissionControlOrchestrationPriority,
  MissionControlOrchestrationPlanState,
  SystemicStabilizationStrategyClass,
} from './mission-control-orchestration-types.ts';

function derivePlanState(input: {
  priority: MissionControlOrchestrationPriority;
  intelligenceOutcome: CrossPortfolioMissionIntelligenceProjection['intelligenceOutcome'];
}): MissionControlOrchestrationPlanState {
  if (input.intelligenceOutcome === 'inconclusive') {
    return 'inconclusive';
  }
  if (input.intelligenceOutcome === 'systemically_blocked') {
    return 'blocked';
  }
  if (input.priority === 'deferred') {
    return 'deferred';
  }
  if (input.priority === 'critical' || input.priority === 'high') {
    return 'active';
  }
  return 'queued';
}

function deriveInitialOutcome(state: MissionControlOrchestrationPlanState): MissionControlOrchestrationOutcome {
  if (state === 'inconclusive') {
    return 'inconclusive';
  }
  if (state === 'blocked') {
    return 'blocked';
  }
  if (state === 'deferred') {
    return 'deferred';
  }
  if (state === 'active') {
    return 'active';
  }
  return 'pending';
}

export function deriveMissionControlInterventionPlan(input: {
  projection: CrossPortfolioMissionIntelligenceProjection;
  strategyClass: SystemicStabilizationStrategyClass;
  priority: MissionControlOrchestrationPriority;
  actionItemIds: string[];
}): MissionControlInterventionPlan {
  const state = derivePlanState({
    priority: input.priority,
    intelligenceOutcome: input.projection.intelligenceOutcome,
  });

  return {
    missionControlInterventionPlanId: deriveMissionControlInterventionPlanId({
      crossPortfolioMissionIntelligenceSetId: input.projection.crossPortfolioMissionIntelligenceSetId,
      strategyClass: input.strategyClass,
      portfolioIds: input.projection.portfolioIds,
      systemicBlockingClusterIds: input.projection.systemicBlockingClusters.map((entry) => entry.systemicBlockingClusterId),
      escalationPatternIds: input.projection.escalationPatterns.map((entry) => entry.crossPortfolioEscalationPatternId),
    }),
    crossPortfolioMissionIntelligenceSetId: input.projection.crossPortfolioMissionIntelligenceSetId,
    displayName: `${input.projection.displayName} Orchestration Plan`,
    strategyClass: input.strategyClass,
    portfolioIds: uniqueSortedStrings(input.projection.portfolioIds),
    systemicBlockingClusterIds: uniqueSortedStrings(
      input.projection.systemicBlockingClusters.map((entry) => entry.systemicBlockingClusterId)
    ),
    escalationPatternIds: uniqueSortedStrings(
      input.projection.escalationPatterns.map((entry) => entry.crossPortfolioEscalationPatternId)
    ),
    actionItemIds: uniqueSortedStrings(input.actionItemIds),
    priority: input.priority,
    outcome: deriveInitialOutcome(state),
    state,
  };
}
