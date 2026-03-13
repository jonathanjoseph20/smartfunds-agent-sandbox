import { describe, expect, it } from 'vitest';

import { createExecutionActivationRecord } from '../../mission-control/execution-activation-record.ts';
import { deriveExecutionActivationFeedbackLinks } from '../../mission-control/execution-activation-feedback-link.ts';
import type { ExecutionRequestRecord } from '../../mission-control/mission-execution-coordination-types.ts';

function request(id: string): ExecutionRequestRecord {
  return {
    executionRequestRecordId: id,
    missionExecutionCoordinationPlanId: 'plan-1',
    missionControlOrchestrationActionItemId: 'action-1',
    executionIntentId: 'intent-1',
    requestClass: 'task_execution_request',
    targetExecutionDomain: 'mission_execution',
    priority: 'high',
    state: 'submitted',
    reasonTokens: [],
  };
}

describe('mission execution activation feedback links', () => {
  it('T-MEA-F1 links request -> activation -> runtime IDs and dedupes deterministically', () => {
    const activation = createExecutionActivationRecord({ request: request('request-1') });

    const links = deriveExecutionActivationFeedbackLinks({
      activationRecords: [activation],
      feedbackRecords: [
        {
          executionRequestRecordId: 'request-1',
          executionAttemptId: 'attempt-1',
          taskExecutionRunId: 'run-1',
          workerResultId: 'worker-1',
          feedbackClass: 'execution_started',
        },
        {
          executionRequestRecordId: 'request-1',
          executionAttemptId: 'attempt-1',
          taskExecutionRunId: 'run-1',
          workerResultId: 'worker-1',
          feedbackClass: 'execution_started',
        },
      ],
    });

    expect(links).toHaveLength(1);
    expect(links[0]!.executionActivationRecordId).toBe(activation.executionActivationRecordId);
    expect(links[0]!.executionAttemptId).toBe('attempt-1');
  });
});
