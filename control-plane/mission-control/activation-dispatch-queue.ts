import {
  deriveActivationDispatchQueueEntryId,
  uniqueSortedStrings,
} from './activation-runtime-integration-identity.ts';
import type {
  ActivationDispatchAttempt,
  ActivationDispatchQueueEntry,
  ActivationDispatchQueueState,
  ActivationRuntimeIntegrationHistoryEvent,
  ActivationRuntimeLink,
  RuntimeFeedbackIngestionRecord,
} from './activation-runtime-integration-types.ts';

function priorityRank(priority: string): number {
  if (priority === 'critical') {
    return 5;
  }
  if (priority === 'high') {
    return 4;
  }
  if (priority === 'normal') {
    return 3;
  }
  if (priority === 'low') {
    return 2;
  }
  return 1;
}

function deriveQueueState(input: {
  dispatchAttempt: ActivationDispatchAttempt;
  runtimeLinks: ActivationRuntimeLink[];
  feedbackRecords: RuntimeFeedbackIngestionRecord[];
  historyEntries: ActivationRuntimeIntegrationHistoryEvent[];
}): ActivationDispatchQueueState {
  let queueState: ActivationDispatchQueueState = input.dispatchAttempt.state === 'submitted'
    ? 'dispatch_submitted'
    : (input.dispatchAttempt.state === 'active'
        ? 'under_runtime_execution'
        : (input.dispatchAttempt.state === 'completed'
            ? 'closed'
            : (input.dispatchAttempt.state === 'failed'
                ? 'blocked'
                : (input.dispatchAttempt.state === 'deferred' ? 'deferred' : 'queued'))));

  for (const entry of input.historyEntries) {
    if (entry.eventType === 'activation_dispatch_queued') {
      queueState = 'awaiting_dispatch';
      continue;
    }
    if (entry.eventType === 'activation_dispatch_submitted') {
      queueState = 'dispatch_submitted';
      continue;
    }
    if (entry.eventType === 'activation_runtime_deferred') {
      queueState = 'deferred';
      continue;
    }
    if (entry.eventType === 'activation_runtime_completed') {
      queueState = 'closed';
      continue;
    }
    if (entry.eventType === 'activation_runtime_failed') {
      queueState = 'blocked';
    }
  }

  const linkClasses = input.runtimeLinks.map((entry) => entry.runtimeLinkClass);
  const feedbackClasses = input.feedbackRecords.map((entry) => entry.feedbackClass);

  if (linkClasses.includes('runtime_inconclusive') || feedbackClasses.includes('runtime_execution_inconclusive')) {
    return 'blocked';
  }
  if (linkClasses.includes('runtime_failed') || feedbackClasses.includes('runtime_execution_failed') || feedbackClasses.includes('runtime_execution_blocked')) {
    return 'blocked';
  }
  if (linkClasses.includes('runtime_completed') || feedbackClasses.includes('runtime_execution_completed')) {
    return 'closed';
  }
  if (linkClasses.includes('runtime_started') || feedbackClasses.includes('runtime_execution_started')) {
    return 'under_runtime_execution';
  }
  if (linkClasses.includes('dispatch_submitted') || feedbackClasses.includes('runtime_dispatch_accepted')) {
    return 'dispatch_submitted';
  }
  if (feedbackClasses.includes('runtime_execution_retrying') || linkClasses.includes('runtime_retrying')) {
    return 'awaiting_dispatch';
  }

  return queueState;
}

export function deriveActivationDispatchQueueEntry(input: {
  dispatchAttempt: ActivationDispatchAttempt;
  runtimeLinks: ActivationRuntimeLink[];
  feedbackRecords: RuntimeFeedbackIngestionRecord[];
  historyEntries: ActivationRuntimeIntegrationHistoryEvent[];
}): ActivationDispatchQueueEntry {
  const queueState = deriveQueueState(input);
  const reasonTokens = uniqueSortedStrings([
    `queue_state:${queueState}`,
    `runtime_links:${String(input.runtimeLinks.length)}`,
    `feedback_records:${String(input.feedbackRecords.length)}`,
  ]);

  return {
    activationDispatchQueueEntryId: deriveActivationDispatchQueueEntryId({
      activationDispatchAttemptId: input.dispatchAttempt.activationDispatchAttemptId,
      priority: input.dispatchAttempt.priority,
      queueState,
      reasonTokens,
    }),
    activationDispatchAttemptId: input.dispatchAttempt.activationDispatchAttemptId,
    priority: input.dispatchAttempt.priority,
    queueState,
    reasonTokens,
    state: queueState === 'closed'
      ? 'resolved'
      : (queueState === 'blocked' ? 'inconclusive' : 'active'),
  };
}

export function sortActivationDispatchQueue(entries: ActivationDispatchQueueEntry[]): ActivationDispatchQueueEntry[] {
  return [...entries].sort((left, right) => {
    const byPriority = priorityRank(right.priority) - priorityRank(left.priority);
    if (byPriority !== 0) {
      return byPriority;
    }
    return left.activationDispatchAttemptId.localeCompare(right.activationDispatchAttemptId);
  });
}
