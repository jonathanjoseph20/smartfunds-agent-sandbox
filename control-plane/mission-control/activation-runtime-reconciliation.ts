import {
  deriveActivationRuntimeReconciliationId,
  uniqueSortedStrings,
} from './activation-runtime-integration-identity.ts';
import type {
  ActivationRuntimeReconciliation,
  ActivationRuntimeReconciliationClass,
  RuntimeFeedbackIngestionRecord,
} from './activation-runtime-integration-types.ts';

function deriveReconciliationClass(feedbackRecords: RuntimeFeedbackIngestionRecord[]): ActivationRuntimeReconciliationClass {
  if (feedbackRecords.length === 0) {
    return 'feedback_incomplete';
  }

  const classes = feedbackRecords.map((entry) => entry.feedbackClass);

  const hasCompleted = classes.includes('runtime_execution_completed');
  const hasFailed = classes.includes('runtime_execution_failed') || classes.includes('runtime_execution_blocked');
  if (hasCompleted && hasFailed) {
    return 'feedback_conflict';
  }

  if (classes.includes('runtime_execution_inconclusive')) {
    return 'feedback_inconclusive';
  }

  if (classes.includes('runtime_execution_retrying')) {
    return 'feedback_deferred';
  }

  return 'feedback_applied';
}

export function deriveActivationRuntimeReconciliation(input: {
  activationDispatchAttemptId: string;
  feedbackRecords: RuntimeFeedbackIngestionRecord[];
}): ActivationRuntimeReconciliation {
  const reconciliationClass = deriveReconciliationClass(input.feedbackRecords);
  const linkedFeedbackRecordIds = uniqueSortedStrings(
    input.feedbackRecords.map((entry) => entry.runtimeFeedbackIngestionRecordId)
  );
  const reasonTokens = uniqueSortedStrings([
    `reconciliation_class:${reconciliationClass}`,
    `feedback_records:${String(linkedFeedbackRecordIds.length)}`,
  ]);

  return {
    activationRuntimeReconciliationId: deriveActivationRuntimeReconciliationId({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      reconciliationClass,
      linkedFeedbackRecordIds,
      reasonTokens,
    }),
    activationDispatchAttemptId: input.activationDispatchAttemptId,
    reconciliationClass,
    reasonTokens,
    linkedFeedbackRecordIds,
    state: reconciliationClass === 'feedback_applied'
      ? 'resolved'
      : (reconciliationClass === 'feedback_conflict' || reconciliationClass === 'feedback_inconclusive'
          ? 'inconclusive'
          : 'active'),
  };
}
