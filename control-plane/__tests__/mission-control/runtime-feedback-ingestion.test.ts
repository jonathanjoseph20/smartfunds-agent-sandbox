import { describe, expect, it } from 'vitest';

import { createActivationDispatchAttempt } from '../../mission-control/activation-dispatch-attempt.ts';
import { deriveRuntimeFeedbackIngestionRecords } from '../../mission-control/runtime-feedback-ingestion-record.ts';
import type { ExecutionActivationRecord } from '../../mission-control/mission-execution-activation-types.ts';

const activationRecord: ExecutionActivationRecord = {
  executionActivationRecordId: 'activation-1',
  executionRequestRecordId: 'request-1',
  missionExecutionCoordinationPlanId: 'plan-1',
  executionIntentId: 'intent-1',
  targetExecutionDomain: 'mission_execution',
  priority: 'high',
  state: 'submitted',
  outcome: 'submitted',
};

describe('runtime feedback ingestion', () => {
  it('T-ARI-F1 ingestion dedupes deterministically', () => {
    const attempt = createActivationDispatchAttempt({ activationRecord });

    const records = deriveRuntimeFeedbackIngestionRecords({
      dispatchAttempts: [attempt],
      feedbackRecords: [
        {
          activationDispatchAttemptId: attempt.activationDispatchAttemptId,
          feedbackClass: 'runtime_execution_started',
          linkedRuntimeIds: {
            executionAttemptId: 'exec-attempt-1',
            taskExecutionRunId: 'run-1',
            workerResultId: 'worker-1',
          },
        },
        {
          activationDispatchAttemptId: attempt.activationDispatchAttemptId,
          feedbackClass: 'runtime_execution_started',
          linkedRuntimeIds: {
            executionAttemptId: 'exec-attempt-1',
            taskExecutionRunId: 'run-1',
            workerResultId: 'worker-1',
          },
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.feedbackClass).toBe('runtime_execution_started');
  });

  it('T-ARI-F2 unknown feedback classes normalize to inconclusive', () => {
    const attempt = createActivationDispatchAttempt({ activationRecord });

    const records = deriveRuntimeFeedbackIngestionRecords({
      dispatchAttempts: [attempt],
      feedbackRecords: [{
        activationDispatchAttemptId: attempt.activationDispatchAttemptId,
        feedbackClass: 'unknown_feedback_class',
      }],
    });

    expect(records[0]?.feedbackClass).toBe('runtime_execution_inconclusive');
  });
});
