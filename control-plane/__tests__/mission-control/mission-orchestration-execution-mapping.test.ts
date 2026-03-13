import { describe, expect, it } from 'vitest';

import {
  deriveMissionOrchestrationExecutionMappings,
  listSeedMissionOrchestrationExecutionMappings,
} from '../../mission-control/mission-orchestration-execution-mapping.ts';

describe('mission orchestration execution mapping', () => {
  it('T-MEC-M1 maps seeded action classes to deterministic intent mappings', () => {
    const mappings = deriveMissionOrchestrationExecutionMappings({
      actionItems: [
        {
          missionControlOrchestrationActionItemId: 'a1',
          missionControlInterventionPlanId: 'p1',
          actionClass: 'maintain_watch_state',
          priority: 'normal',
          reasonTokens: [],
          linkedPortfolioIds: [],
          linkedRequirementIds: [],
          linkedEscalationPatternIds: [],
          state: 'pending',
        },
        {
          missionControlOrchestrationActionItemId: 'a2',
          missionControlInterventionPlanId: 'p1',
          actionClass: 'request_portfolio_review',
          priority: 'high',
          reasonTokens: [],
          linkedPortfolioIds: [],
          linkedRequirementIds: [],
          linkedEscalationPatternIds: [],
          state: 'active',
        },
      ],
    });

    expect(mappings).toHaveLength(2);
    expect(mappings.map((entry) => entry.executionIntentClass).sort((left, right) => left.localeCompare(right))).toEqual([
      'monitoring_task_intent',
      'review_request_intent',
    ]);
  });

  it('T-MEC-M2 unrelated action classes are ignored deterministically', () => {
    const mappings = deriveMissionOrchestrationExecutionMappings({
      actionItems: [
        {
          missionControlOrchestrationActionItemId: 'a1',
          missionControlInterventionPlanId: 'p1',
          actionClass: 'prioritize_portfolio_attention',
          priority: 'high',
          reasonTokens: [],
          linkedPortfolioIds: [],
          linkedRequirementIds: [],
          linkedEscalationPatternIds: [],
          state: 'active',
        },
      ],
    });

    expect(mappings).toEqual([]);
    expect(listSeedMissionOrchestrationExecutionMappings().map((entry) => entry.actionClass)).toEqual([
      'maintain_watch_state',
      'request_portfolio_review',
      'request_resolution_reassessment',
      'stabilize_blocking_cluster',
    ]);
  });
});
