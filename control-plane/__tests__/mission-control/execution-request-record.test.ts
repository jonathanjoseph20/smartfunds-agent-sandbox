import { describe, expect, it } from 'vitest';

import {
  deriveExecutionRequestRecords,
  sortExecutionRequestQueue,
} from '../../mission-control/execution-request-record.ts';

describe('execution request record', () => {
  it('T-MEC-R1 generates deterministic requests and queue ordering', () => {
    const requests = deriveExecutionRequestRecords({
      missionExecutionCoordinationPlanId: 'exec-plan-1',
      intents: [
        {
          executionIntentId: 'intent-1',
          missionExecutionCoordinationPlanId: 'exec-plan-1',
          intentClass: 'review_request_intent',
          reasonTokens: [],
          linkedActionItemIds: ['a2'],
          state: 'active',
        },
        {
          executionIntentId: 'intent-2',
          missionExecutionCoordinationPlanId: 'exec-plan-1',
          intentClass: 'monitoring_task_intent',
          reasonTokens: [],
          linkedActionItemIds: ['a1'],
          state: 'queued',
        },
      ],
      mappings: [
        {
          missionOrchestrationExecutionMappingId: 'm2',
          missionControlOrchestrationActionItemId: 'a2',
          executionIntentClass: 'review_request_intent',
          requestGenerationRule: 'review_execution_request',
          reasonTokens: [],
          state: 'active',
        },
        {
          missionOrchestrationExecutionMappingId: 'm1',
          missionControlOrchestrationActionItemId: 'a1',
          executionIntentClass: 'monitoring_task_intent',
          requestGenerationRule: 'monitoring_request',
          reasonTokens: [],
          state: 'active',
        },
      ],
      actionItems: [],
      priority: 'high',
    });

    const sorted = sortExecutionRequestQueue(requests);

    expect(requests).toHaveLength(2);
    expect(sorted[0]!.state).toBe('active');
    expect(sorted[1]!.state).toBe('queued');
  });
});
