import {
  deriveAttemptStatusFromQueueState,
  uniqueSortedStrings,
} from './activation-runtime-integration-identity.ts';
import type {
  ActivationAttemptStatusRecord,
  ActivationDispatchQueueEntry,
  ActivationRuntimeIntegrationHistoryEvent,
  RuntimeFeedbackIngestionRecord,
} from './activation-runtime-integration-types.ts';

export function deriveActivationAttemptStatus(input: {
  activationDispatchAttemptId: string;
  dispatchQueueEntry: ActivationDispatchQueueEntry;
  feedbackRecords: RuntimeFeedbackIngestionRecord[];
  historyEntries: ActivationRuntimeIntegrationHistoryEvent[];
}): ActivationAttemptStatusRecord {
  const feedbackClasses = input.feedbackRecords.map((entry) => entry.feedbackClass);

  let status = deriveAttemptStatusFromQueueState({
    queueState: input.dispatchQueueEntry.queueState,
    hasFeedback: feedbackClasses.length > 0,
  });

  for (const entry of input.historyEntries) {
    if (entry.eventType === 'activation_runtime_deferred') {
      status = 'runtime_deferred';
      continue;
    }
    if (entry.eventType === 'activation_dispatch_submitted') {
      status = 'dispatch_submitted';
      continue;
    }
    if (entry.eventType === 'activation_runtime_completed') {
      status = 'runtime_completed';
      continue;
    }
    if (entry.eventType === 'activation_runtime_failed') {
      status = 'runtime_failed';
    }
  }

  if (feedbackClasses.includes('runtime_execution_inconclusive')) {
    status = 'inconclusive';
  } else if (feedbackClasses.includes('runtime_execution_failed') || feedbackClasses.includes('runtime_execution_blocked')) {
    status = 'runtime_failed';
  } else if (feedbackClasses.includes('runtime_execution_completed')) {
    status = 'runtime_completed';
  } else if (feedbackClasses.includes('runtime_execution_started')) {
    status = 'runtime_active';
  } else if (feedbackClasses.includes('runtime_dispatch_accepted')) {
    status = 'dispatch_submitted';
  }

  return {
    activationDispatchAttemptId: input.activationDispatchAttemptId,
    status,
    reasonTokens: uniqueSortedStrings([
      `status:${status}`,
      `dispatch_queue_state:${input.dispatchQueueEntry.queueState}`,
      `feedback_count:${String(input.feedbackRecords.length)}`,
    ]),
  };
}
