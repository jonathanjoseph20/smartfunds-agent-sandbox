import { describe, expect, it } from 'vitest';

import { deriveExecutionFeedbackLinks } from '../../mission-control/execution-feedback-link.ts';

describe('execution feedback link', () => {
  it('T-MEC-F1 links execution feedback deterministically with replay-safe partial identifiers', () => {
    const first = deriveExecutionFeedbackLinks({
      missionExecutionCoordinationPlanId: 'exec-plan-1',
      requests: [
        {
          executionRequestRecordId: 'request-1',
          missionExecutionCoordinationPlanId: 'exec-plan-1',
          missionControlOrchestrationActionItemId: 'action-1',
          executionIntentId: 'intent-1',
          requestClass: 'task_execution_request',
          targetExecutionDomain: 'mission_execution',
          priority: 'high',
          state: 'queued',
          reasonTokens: [],
        },
      ],
      feedbackRecords: [
        {
          executionRequestRecordId: 'request-1',
          executionAttemptId: null,
          taskExecutionRunId: 'run-1',
          workerResultId: null,
          feedbackClass: 'execution_started',
        },
      ],
    });

    const second = deriveExecutionFeedbackLinks({
      missionExecutionCoordinationPlanId: 'exec-plan-1',
      requests: [
        {
          executionRequestRecordId: 'request-1',
          missionExecutionCoordinationPlanId: 'exec-plan-1',
          missionControlOrchestrationActionItemId: 'action-1',
          executionIntentId: 'intent-1',
          requestClass: 'task_execution_request',
          targetExecutionDomain: 'mission_execution',
          priority: 'high',
          state: 'queued',
          reasonTokens: [],
        },
      ],
      feedbackRecords: [
        {
          executionRequestRecordId: 'request-1',
          executionAttemptId: null,
          taskExecutionRunId: 'run-1',
          workerResultId: null,
          feedbackClass: 'execution_started',
        },
      ],
    });

    expect(second).toEqual(first);
    expect(first[0]!.executionAttemptId).toBeNull();
  });
});
