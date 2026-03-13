import { describe, expect, it } from 'vitest';

import { deriveActivationRuntimeReconciliation } from '../../mission-control/activation-runtime-reconciliation.ts';
import type { RuntimeFeedbackIngestionRecord } from '../../mission-control/activation-runtime-integration-types.ts';

function feedback(id: string, feedbackClass: RuntimeFeedbackIngestionRecord['feedbackClass']): RuntimeFeedbackIngestionRecord {
  return {
    runtimeFeedbackIngestionRecordId: id,
    activationDispatchAttemptId: 'attempt-1',
    activationRuntimeLinkId: 'link-1',
    feedbackClass,
    reasonTokens: [],
    linkedRuntimeIds: {
      executionAttemptId: null,
      taskExecutionRunId: null,
      workerResultId: null,
    },
    state: 'ingested',
  };
}

describe('activation runtime reconciliation', () => {
  it('T-ARI-R1 derives feedback_applied for non-conflicting feedback', () => {
    const result = deriveActivationRuntimeReconciliation({
      activationDispatchAttemptId: 'attempt-1',
      feedbackRecords: [feedback('f-1', 'runtime_execution_started')],
    });

    expect(result.reconciliationClass).toBe('feedback_applied');
  });

  it('T-ARI-R2 derives feedback_conflict when completed and failed both exist', () => {
    const result = deriveActivationRuntimeReconciliation({
      activationDispatchAttemptId: 'attempt-1',
      feedbackRecords: [
        feedback('f-1', 'runtime_execution_completed'),
        feedback('f-2', 'runtime_execution_failed'),
      ],
    });

    expect(result.reconciliationClass).toBe('feedback_conflict');
  });

  it('T-ARI-R3 derives feedback_incomplete when no feedback exists', () => {
    const result = deriveActivationRuntimeReconciliation({
      activationDispatchAttemptId: 'attempt-1',
      feedbackRecords: [],
    });

    expect(result.reconciliationClass).toBe('feedback_incomplete');
  });
});
