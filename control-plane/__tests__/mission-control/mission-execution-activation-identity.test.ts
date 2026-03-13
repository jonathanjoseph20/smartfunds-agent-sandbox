import { describe, expect, it } from 'vitest';

import {
  deriveExecutionActivationEligibilityId,
  deriveExecutionActivationFeedbackLinkId,
  deriveExecutionActivationRecordId,
  deriveExecutionRequestActivationMappingId,
  deriveMissionExecutionActivationQueueEntryId,
} from '../../mission-control/mission-execution-activation-identity.ts';

describe('mission execution activation identity', () => {
  it('T-MEA-ID1 deterministic activation identities are stable across token ordering', () => {
    const recordOne = deriveExecutionActivationRecordId({
      executionRequestRecordId: 'request-1',
      missionExecutionCoordinationPlanId: 'plan-1',
      executionIntentId: 'intent-1',
      targetExecutionDomain: 'mission_execution',
      priority: 'high',
    });

    const recordTwo = deriveExecutionActivationRecordId({
      executionRequestRecordId: 'request-1',
      missionExecutionCoordinationPlanId: 'plan-1',
      executionIntentId: 'intent-1',
      targetExecutionDomain: 'mission_execution',
      priority: 'high',
    });

    const mappingOne = deriveExecutionRequestActivationMappingId({
      executionRequestRecordId: 'request-1',
      executionActivationRecordId: 'activation-1',
      activationRule: 'standard_task_activation',
      reasonTokens: ['b', 'a'],
    });

    const mappingTwo = deriveExecutionRequestActivationMappingId({
      executionRequestRecordId: 'request-1',
      executionActivationRecordId: 'activation-1',
      activationRule: 'standard_task_activation',
      reasonTokens: ['a', 'b'],
    });

    const eligibilityOne = deriveExecutionActivationEligibilityId({
      executionRequestRecordId: 'request-1',
      eligibilityStatus: 'eligible',
      reasonTokens: ['z', 'a'],
      blockingConditionTokens: [],
    });

    const eligibilityTwo = deriveExecutionActivationEligibilityId({
      executionRequestRecordId: 'request-1',
      eligibilityStatus: 'eligible',
      reasonTokens: ['a', 'z'],
      blockingConditionTokens: [],
    });

    const queueOne = deriveMissionExecutionActivationQueueEntryId({
      executionActivationRecordId: 'activation-1',
      priority: 'high',
      queueState: 'queued',
      reasonTokens: ['q2', 'q1'],
    });

    const queueTwo = deriveMissionExecutionActivationQueueEntryId({
      executionActivationRecordId: 'activation-1',
      priority: 'high',
      queueState: 'queued',
      reasonTokens: ['q1', 'q2'],
    });

    const feedbackOne = deriveExecutionActivationFeedbackLinkId({
      executionActivationRecordId: 'activation-1',
      executionRequestRecordId: 'request-1',
      executionAttemptId: 'attempt-1',
      taskExecutionRunId: 'run-1',
      workerResultId: null,
      feedbackClass: 'execution_started',
    });

    const feedbackTwo = deriveExecutionActivationFeedbackLinkId({
      executionActivationRecordId: 'activation-1',
      executionRequestRecordId: 'request-1',
      executionAttemptId: 'attempt-1',
      taskExecutionRunId: 'run-1',
      workerResultId: null,
      feedbackClass: 'execution_started',
    });

    expect(recordTwo).toBe(recordOne);
    expect(mappingTwo).toBe(mappingOne);
    expect(eligibilityTwo).toBe(eligibilityOne);
    expect(queueTwo).toBe(queueOne);
    expect(feedbackTwo).toBe(feedbackOne);
  });
});
