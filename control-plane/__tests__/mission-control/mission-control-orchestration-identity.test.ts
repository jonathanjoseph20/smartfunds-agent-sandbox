import { describe, expect, it } from 'vitest';

import {
  deriveMissionControlInterventionPlanId,
  deriveMissionControlOrchestrationActionItemId,
} from '../../mission-control/mission-control-orchestration-identity.ts';

describe('mission control orchestration identity', () => {
  it('T-MCO-ID1 intervention plan identity is deterministic across ordering', () => {
    const one = deriveMissionControlInterventionPlanId({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      strategyClass: 'dependency_relief_strategy',
      portfolioIds: ['portfolio-b', 'portfolio-a'],
      systemicBlockingClusterIds: ['cluster-b', 'cluster-a'],
      escalationPatternIds: ['pattern-b', 'pattern-a'],
    });

    const two = deriveMissionControlInterventionPlanId({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      strategyClass: 'dependency_relief_strategy',
      portfolioIds: ['portfolio-a', 'portfolio-b'],
      systemicBlockingClusterIds: ['cluster-a', 'cluster-b'],
      escalationPatternIds: ['pattern-a', 'pattern-b'],
    });

    expect(two).toBe(one);
  });

  it('T-MCO-ID2 action item identity is deterministic across ordering', () => {
    const one = deriveMissionControlOrchestrationActionItemId({
      missionControlInterventionPlanId: 'plan-1',
      actionClass: 'stabilize_blocking_cluster',
      priority: 'critical',
      reasonTokens: ['b', 'a'],
      linkedPortfolioIds: ['portfolio-b', 'portfolio-a'],
      linkedRequirementIds: ['req-b', 'req-a'],
      linkedEscalationPatternIds: ['pattern-b', 'pattern-a'],
    });

    const two = deriveMissionControlOrchestrationActionItemId({
      missionControlInterventionPlanId: 'plan-1',
      actionClass: 'stabilize_blocking_cluster',
      priority: 'critical',
      reasonTokens: ['a', 'b'],
      linkedPortfolioIds: ['portfolio-a', 'portfolio-b'],
      linkedRequirementIds: ['req-a', 'req-b'],
      linkedEscalationPatternIds: ['pattern-a', 'pattern-b'],
    });

    expect(two).toBe(one);
  });
});
