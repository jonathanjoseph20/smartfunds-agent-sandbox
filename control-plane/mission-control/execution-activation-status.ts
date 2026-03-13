import {
  deriveActivationStatusFromQueueState,
  uniqueSortedStrings,
} from './mission-execution-activation-identity.ts';
import type {
  ExecutionActivationFeedbackLink,
  ExecutionActivationHistoryEvent,
  ExecutionActivationStatusRecord,
  MissionExecutionActivationQueueEntry,
} from './mission-execution-activation-types.ts';

export function deriveExecutionActivationStatus(input: {
  executionActivationRecordId: string;
  queueEntry: MissionExecutionActivationQueueEntry | null;
  feedbackLinks: ExecutionActivationFeedbackLink[];
  historyEntries: ExecutionActivationHistoryEvent[];
}): ExecutionActivationStatusRecord {
  const feedbackClasses = input.feedbackLinks.map((entry) => entry.feedbackClass);
  let status = deriveActivationStatusFromQueueState({
    queueState: input.queueEntry?.queueState ?? null,
    hasFeedback: feedbackClasses.length > 0,
  });

  for (const entry of input.historyEntries) {
    if (entry.eventType === 'execution_activation_deferred') {
      status = 'activation_deferred';
      continue;
    }
    if (entry.eventType === 'execution_activation_handoff_submitted') {
      status = 'handoff_submitted';
      continue;
    }
    if (entry.eventType === 'execution_activation_completed') {
      status = 'activation_completed';
      continue;
    }
    if (entry.eventType === 'execution_activation_failed') {
      status = 'activation_failed';
    }
  }

  if (feedbackClasses.includes('execution_inconclusive')) {
    status = 'inconclusive';
  } else if (feedbackClasses.includes('execution_failed') || feedbackClasses.includes('execution_blocked')) {
    status = 'activation_failed';
  } else if (feedbackClasses.includes('execution_completed')) {
    status = 'activation_completed';
  } else if (feedbackClasses.includes('execution_started')) {
    status = 'activation_active';
  } else if (feedbackClasses.includes('handoff_submitted')) {
    status = 'handoff_submitted';
  }

  return {
    executionActivationRecordId: input.executionActivationRecordId,
    status,
    reasonTokens: uniqueSortedStrings([
      `status:${status}`,
      `queue_state:${input.queueEntry?.queueState ?? 'none'}`,
      `feedback_count:${String(input.feedbackLinks.length)}`,
    ]),
  };
}
