import { describe, expect, it } from 'vitest';

import {
  deriveExecutionFeedbackLinkId,
  deriveExecutionIntentId,
  deriveExecutionRequestRecordId,
  deriveMissionExecutionCoordinationPlanId,
  deriveMissionOrchestrationExecutionMappingId,
} from '../../mission-control/mission-execution-coordination-identity.ts';

describe('mission execution coordination identity', () => {
  it('T-MEC-ID1 deterministic plan identity across ordering', () => {
    const one = deriveMissionExecutionCoordinationPlanId({
      missionControlInterventionPlanId: 'plan-1',
      strategyClass: 'systemic_watch_strategy',
      priority: 'high',
      linkedActionItemIds: ['a2', 'a1'],
    });

    const two = deriveMissionExecutionCoordinationPlanId({
      missionControlInterventionPlanId: 'plan-1',
      strategyClass: 'systemic_watch_strategy',
      priority: 'high',
      linkedActionItemIds: ['a1', 'a2'],
    });

    expect(two).toBe(one);
  });

  it('T-MEC-ID2 deterministic mapping/intent/request/feedback identities across ordering', () => {
    const mappingOne = deriveMissionOrchestrationExecutionMappingId({
      missionControlOrchestrationActionItemId: 'action-1',
      executionIntentClass: 'monitoring_task_intent',
      requestGenerationRule: 'monitoring_request',
      reasonTokens: ['b', 'a'],
    });

    const mappingTwo = deriveMissionOrchestrationExecutionMappingId({
      missionControlOrchestrationActionItemId: 'action-1',
      executionIntentClass: 'monitoring_task_intent',
      requestGenerationRule: 'monitoring_request',
      reasonTokens: ['a', 'b'],
    });

    const intentOne = deriveExecutionIntentId({
      missionExecutionCoordinationPlanId: 'exec-plan-1',
      intentClass: 'review_request_intent',
      linkedActionItemIds: ['b', 'a'],
      reasonTokens: ['b', 'a'],
    });

    const intentTwo = deriveExecutionIntentId({
      missionExecutionCoordinationPlanId: 'exec-plan-1',
      intentClass: 'review_request_intent',
      linkedActionItemIds: ['a', 'b'],
      reasonTokens: ['a', 'b'],
    });

    const requestOne = deriveExecutionRequestRecordId({
      missionExecutionCoordinationPlanId: 'exec-plan-1',
      missionControlOrchestrationActionItemId: 'action-1',
      executionIntentId: 'intent-1',
      requestClass: 'task_execution_request',
      targetExecutionDomain: 'mission_execution',
      priority: 'high',
      reasonTokens: ['z', 'a'],
    });

    const requestTwo = deriveExecutionRequestRecordId({
      missionExecutionCoordinationPlanId: 'exec-plan-1',
      missionControlOrchestrationActionItemId: 'action-1',
      executionIntentId: 'intent-1',
      requestClass: 'task_execution_request',
      targetExecutionDomain: 'mission_execution',
      priority: 'high',
      reasonTokens: ['a', 'z'],
    });

    const feedbackOne = deriveExecutionFeedbackLinkId({
      executionRequestRecordId: 'request-1',
      executionAttemptId: 'attempt-1',
      taskExecutionRunId: null,
      workerResultId: null,
      missionControlOrchestrationActionItemId: 'action-1',
      missionExecutionCoordinationPlanId: 'exec-plan-1',
      feedbackClass: 'execution_started',
    });

    const feedbackTwo = deriveExecutionFeedbackLinkId({
      executionRequestRecordId: 'request-1',
      executionAttemptId: 'attempt-1',
      taskExecutionRunId: null,
      workerResultId: null,
      missionControlOrchestrationActionItemId: 'action-1',
      missionExecutionCoordinationPlanId: 'exec-plan-1',
      feedbackClass: 'execution_started',
    });

    expect(mappingTwo).toBe(mappingOne);
    expect(intentTwo).toBe(intentOne);
    expect(requestTwo).toBe(requestOne);
    expect(feedbackTwo).toBe(feedbackOne);
  });
});
