import {
  deriveActivationRuntimeLinkId,
  uniqueSortedStrings,
} from './activation-runtime-integration-identity.ts';
import type {
  ActivationDispatchAttempt,
  ActivationRuntimeLink,
  ActivationRuntimeLinkClass,
} from './activation-runtime-integration-types.ts';

function classFromFeedbackClass(feedbackClass: string): ActivationRuntimeLinkClass | null {
  if (feedbackClass === 'runtime_dispatch_accepted') {
    return 'dispatch_submitted';
  }
  if (feedbackClass === 'runtime_execution_started') {
    return 'runtime_started';
  }
  if (feedbackClass === 'runtime_execution_completed') {
    return 'runtime_completed';
  }
  if (feedbackClass === 'runtime_execution_failed' || feedbackClass === 'runtime_execution_blocked') {
    return 'runtime_failed';
  }
  if (feedbackClass === 'runtime_execution_retrying') {
    return 'runtime_retrying';
  }
  if (feedbackClass === 'runtime_execution_inconclusive') {
    return 'runtime_inconclusive';
  }
  return null;
}

export function deriveActivationRuntimeLinks(input: {
  dispatchAttempts: ActivationDispatchAttempt[];
  linkRecords?: Array<{
    activationDispatchAttemptId?: string;
    executionActivationRecordId?: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    runtimeLinkClass: ActivationRuntimeLinkClass;
  }>;
  feedbackRecords?: Array<{
    activationDispatchAttemptId?: string;
    executionActivationRecordId?: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    feedbackClass: string;
  }>;
}): ActivationRuntimeLink[] {
  const attemptsById = new Map(input.dispatchAttempts.map((entry) => [entry.activationDispatchAttemptId, entry]));
  const attemptsByActivation = new Map(input.dispatchAttempts.map((entry) => [entry.executionActivationRecordId, entry]));

  const normalizedFromLinks = (input.linkRecords ?? [])
    .map((record) => {
      const attempt = (record.activationDispatchAttemptId
        ? attemptsById.get(record.activationDispatchAttemptId)
        : undefined)
        ?? (record.executionActivationRecordId
          ? attemptsByActivation.get(record.executionActivationRecordId)
          : undefined)
        ?? null;

      if (!attempt) {
        return null;
      }

      return {
        activationRuntimeLinkId: deriveActivationRuntimeLinkId({
          activationDispatchAttemptId: attempt.activationDispatchAttemptId,
          executionActivationRecordId: attempt.executionActivationRecordId,
          executionAttemptId: record.executionAttemptId ?? null,
          taskExecutionRunId: record.taskExecutionRunId ?? null,
          workerResultId: record.workerResultId ?? null,
          runtimeLinkClass: record.runtimeLinkClass,
        }),
        activationDispatchAttemptId: attempt.activationDispatchAttemptId,
        executionActivationRecordId: attempt.executionActivationRecordId,
        executionAttemptId: record.executionAttemptId ?? null,
        taskExecutionRunId: record.taskExecutionRunId ?? null,
        workerResultId: record.workerResultId ?? null,
        runtimeLinkClass: record.runtimeLinkClass,
        state: 'linked',
      } satisfies ActivationRuntimeLink;
    })
    .filter((entry): entry is ActivationRuntimeLink => entry !== null);

  const normalizedFromFeedback = (input.feedbackRecords ?? [])
    .map((record) => {
      const runtimeLinkClass = classFromFeedbackClass(record.feedbackClass);
      if (!runtimeLinkClass) {
        return null;
      }

      const attempt = (record.activationDispatchAttemptId
        ? attemptsById.get(record.activationDispatchAttemptId)
        : undefined)
        ?? (record.executionActivationRecordId
          ? attemptsByActivation.get(record.executionActivationRecordId)
          : undefined)
        ?? null;

      if (!attempt) {
        return null;
      }

      return {
        activationRuntimeLinkId: deriveActivationRuntimeLinkId({
          activationDispatchAttemptId: attempt.activationDispatchAttemptId,
          executionActivationRecordId: attempt.executionActivationRecordId,
          executionAttemptId: record.executionAttemptId ?? null,
          taskExecutionRunId: record.taskExecutionRunId ?? null,
          workerResultId: record.workerResultId ?? null,
          runtimeLinkClass,
        }),
        activationDispatchAttemptId: attempt.activationDispatchAttemptId,
        executionActivationRecordId: attempt.executionActivationRecordId,
        executionAttemptId: record.executionAttemptId ?? null,
        taskExecutionRunId: record.taskExecutionRunId ?? null,
        workerResultId: record.workerResultId ?? null,
        runtimeLinkClass,
        state: 'linked',
      } satisfies ActivationRuntimeLink;
    })
    .filter((entry): entry is ActivationRuntimeLink => entry !== null);

  const deduped = new Map(
    [...normalizedFromLinks, ...normalizedFromFeedback].map((entry) => [entry.activationRuntimeLinkId, entry])
  );

  return Array.from(deduped.values())
    .sort((left, right) => left.activationRuntimeLinkId.localeCompare(right.activationRuntimeLinkId));
}

export function summarizeLinkedExecutionAttemptIds(links: ActivationRuntimeLink[]): string[] {
  return uniqueSortedStrings(
    links.map((entry) => entry.executionAttemptId ?? '').filter((entry) => entry.length > 0)
  );
}
