import {
  deriveMissionExecutionActivationQueueEntryId,
  uniqueSortedStrings,
} from './mission-execution-activation-identity.ts';
import type {
  ExecutionActivationEligibility,
  ExecutionActivationFeedbackLink,
  ExecutionActivationHistoryEvent,
  ExecutionActivationRecord,
  MissionExecutionActivationQueueEntry,
  MissionExecutionActivationQueueState,
} from './mission-execution-activation-types.ts';

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
  activationRecord: ExecutionActivationRecord;
  eligibility: ExecutionActivationEligibility;
  feedbackLinks: ExecutionActivationFeedbackLink[];
  historyEntries: ExecutionActivationHistoryEvent[];
}): MissionExecutionActivationQueueState {
  if (input.eligibility.eligibilityStatus === 'blocked_from_activation') {
    return 'blocked';
  }

  let state: MissionExecutionActivationQueueState = input.eligibility.eligibilityStatus === 'not_eligible'
    ? 'deferred'
    : (input.eligibility.eligibilityStatus === 'eligible' ? 'awaiting_handoff' : 'queued');

  for (const entry of input.historyEntries) {
    if (entry.eventType === 'execution_activation_deferred') {
      state = 'deferred';
      continue;
    }
    if (entry.eventType === 'execution_activation_handoff_submitted') {
      state = 'handoff_submitted';
      continue;
    }
    if (entry.eventType === 'execution_activation_completed') {
      state = 'closed';
      continue;
    }
    if (entry.eventType === 'execution_activation_failed') {
      state = 'blocked';
    }
  }

  const feedbackClasses = input.feedbackLinks.map((entry) => entry.feedbackClass);
  if (feedbackClasses.includes('execution_inconclusive')) {
    return 'blocked';
  }
  if (feedbackClasses.includes('execution_failed') || feedbackClasses.includes('execution_blocked')) {
    return 'blocked';
  }
  if (feedbackClasses.includes('execution_completed')) {
    return 'closed';
  }
  if (feedbackClasses.includes('execution_started')) {
    return 'under_activation';
  }
  if (feedbackClasses.includes('handoff_submitted')) {
    return 'handoff_submitted';
  }

  if (input.activationRecord.state === 'deferred') {
    return 'deferred';
  }
  if (input.activationRecord.state === 'completed') {
    return 'closed';
  }
  if (input.activationRecord.state === 'failed') {
    return 'blocked';
  }
  if (input.activationRecord.state === 'active') {
    return 'under_activation';
  }
  if (input.activationRecord.state === 'submitted') {
    return 'handoff_submitted';
  }
  if (state === 'awaiting_handoff') {
    return 'awaiting_handoff';
  }
  return state;
}

export function deriveMissionExecutionActivationQueueEntry(input: {
  activationRecord: ExecutionActivationRecord;
  eligibility: ExecutionActivationEligibility;
  feedbackLinks: ExecutionActivationFeedbackLink[];
  historyEntries: ExecutionActivationHistoryEvent[];
}): MissionExecutionActivationQueueEntry {
  const queueState = deriveQueueState(input);
  const reasonTokens = uniqueSortedStrings([
    `eligibility:${input.eligibility.eligibilityStatus}`,
    `queue_state:${queueState}`,
    `feedback_count:${String(input.feedbackLinks.length)}`,
  ]);

  return {
    missionExecutionActivationQueueEntryId: deriveMissionExecutionActivationQueueEntryId({
      executionActivationRecordId: input.activationRecord.executionActivationRecordId,
      priority: input.activationRecord.priority,
      queueState,
      reasonTokens,
    }),
    executionActivationRecordId: input.activationRecord.executionActivationRecordId,
    priority: input.activationRecord.priority,
    queueState,
    reasonTokens,
    state: queueState === 'closed'
      ? 'resolved'
      : (queueState === 'blocked' ? 'inconclusive' : 'active'),
  };
}

export function sortMissionExecutionActivationQueue(entries: MissionExecutionActivationQueueEntry[]): MissionExecutionActivationQueueEntry[] {
  return [...entries].sort((left, right) => {
    const byPriority = priorityRank(right.priority) - priorityRank(left.priority);
    if (byPriority !== 0) {
      return byPriority;
    }
    return left.executionActivationRecordId.localeCompare(right.executionActivationRecordId);
  });
}
