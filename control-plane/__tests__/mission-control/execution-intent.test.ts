import { describe, expect, it } from 'vitest';

import { deriveExecutionIntents } from '../../mission-control/execution-intent.ts';

describe('execution intent', () => {
  it('T-MEC-I1 creates intents linked to orchestration items with deterministic ordering', () => {
    const intents = deriveExecutionIntents({
      missionExecutionCoordinationPlanId: 'exec-plan-1',
      mappings: [
        {
          missionOrchestrationExecutionMappingId: 'm2',
          missionControlOrchestrationActionItemId: 'a2',
          executionIntentClass: 'review_request_intent',
          requestGenerationRule: 'review_execution_request',
          reasonTokens: ['b'],
          state: 'active',
        },
        {
          missionOrchestrationExecutionMappingId: 'm1',
          missionControlOrchestrationActionItemId: 'a1',
          executionIntentClass: 'monitoring_task_intent',
          requestGenerationRule: 'monitoring_request',
          reasonTokens: ['a'],
          state: 'active',
        },
      ],
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

    expect(intents).toHaveLength(2);
    expect(intents[0]!.executionIntentId < intents[1]!.executionIntentId).toBe(true);
    expect(intents[0]!.linkedActionItemIds).toHaveLength(1);
    expect(intents[1]!.linkedActionItemIds).toHaveLength(1);
  });
});
