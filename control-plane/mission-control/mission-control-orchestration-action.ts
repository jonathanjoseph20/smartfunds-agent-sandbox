import {
  deriveMissionControlOrchestrationActionItemId,
  uniqueSortedStrings,
} from './mission-control-orchestration-identity.ts';
import type {
  CrossPortfolioMissionIntelligenceProjection,
} from './cross-portfolio-mission-intelligence-types.ts';
import type {
  MissionControlOrchestrationActionClass,
  MissionControlOrchestrationActionItem,
  MissionControlOrchestrationPriority,
  SystemicStabilizationStrategyClass,
} from './mission-control-orchestration-types.ts';

function actionStateForPriority(priority: MissionControlOrchestrationPriority): MissionControlOrchestrationActionItem['state'] {
  if (priority === 'critical' || priority === 'high') {
    return 'active';
  }
  if (priority === 'deferred') {
    return 'deferred';
  }
  return 'pending';
}

function strategyActionClasses(strategyClass: SystemicStabilizationStrategyClass): MissionControlOrchestrationActionClass[] {
  if (strategyClass === 'dependency_relief_strategy') {
    return ['stabilize_blocking_cluster', 'request_resolution_reassessment'];
  }
  if (strategyClass === 'governance_resolution_strategy') {
    return ['request_portfolio_review', 'escalate_systemic_condition'];
  }
  if (strategyClass === 'blocking_cluster_reduction_strategy') {
    return ['stabilize_blocking_cluster', 'prioritize_portfolio_attention'];
  }
  if (strategyClass === 'critical_priority_stabilization_strategy') {
    return ['prioritize_portfolio_attention', 'request_resolution_reassessment'];
  }
  if (strategyClass === 'resolution_recovery_strategy') {
    return ['request_resolution_reassessment', 'defer_noncritical_portfolio'];
  }
  return ['maintain_watch_state'];
}

export function deriveMissionControlOrchestrationActionItems(input: {
  missionControlInterventionPlanId: string;
  projection: CrossPortfolioMissionIntelligenceProjection;
  strategyClass: SystemicStabilizationStrategyClass;
  priority: MissionControlOrchestrationPriority;
}): MissionControlOrchestrationActionItem[] {
  const actionClasses = strategyActionClasses(input.strategyClass);

  const linkedRequirementIds = uniqueSortedStrings([
    ...input.projection.sharedDependencies.map((entry) => entry.crossPortfolioSharedDependencyId),
    ...input.projection.systemicBlockingClusters.map((entry) => entry.systemicBlockingClusterId),
  ]);

  return actionClasses
    .map((actionClass) => {
      const reasonTokens = uniqueSortedStrings([
        `action_class:${actionClass}`,
        `strategy_class:${input.strategyClass}`,
        `priority:${input.priority}`,
        `intelligence_outcome:${input.projection.intelligenceOutcome}`,
      ]);

      return {
        missionControlOrchestrationActionItemId: deriveMissionControlOrchestrationActionItemId({
          missionControlInterventionPlanId: input.missionControlInterventionPlanId,
          actionClass,
          priority: input.priority,
          reasonTokens,
          linkedPortfolioIds: input.projection.portfolioIds,
          linkedRequirementIds,
          linkedEscalationPatternIds: input.projection.escalationPatterns.map((entry) => entry.crossPortfolioEscalationPatternId),
        }),
        missionControlInterventionPlanId: input.missionControlInterventionPlanId,
        actionClass,
        priority: input.priority,
        reasonTokens,
        linkedPortfolioIds: [...input.projection.portfolioIds],
        linkedRequirementIds,
        linkedEscalationPatternIds: uniqueSortedStrings(
          input.projection.escalationPatterns.map((entry) => entry.crossPortfolioEscalationPatternId)
        ),
        state: actionStateForPriority(input.priority),
      };
    })
    .sort((left, right) => left.missionControlOrchestrationActionItemId.localeCompare(right.missionControlOrchestrationActionItemId));
}
