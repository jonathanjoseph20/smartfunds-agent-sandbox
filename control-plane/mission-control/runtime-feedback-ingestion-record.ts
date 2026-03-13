import {
  deriveActivationRuntimeLinkId,
  deriveRuntimeFeedbackIngestionRecordId,
  normalizeRuntimeLinkedIds,
  uniqueSortedStrings,
} from './activation-runtime-integration-identity.ts';
import { normalizeRuntimeFeedbackClass } from './activation-runtime-feedback-normalizer.ts';
import type {
  ActivationDispatchAttempt,
  RuntimeFeedbackIngestionRecord,
} from './activation-runtime-integration-types.ts';

export function deriveRuntimeFeedbackIngestionRecords(input: {
  dispatchAttempts: ActivationDispatchAttempt[];
  feedbackRecords?: Array<{
    activationDispatchAttemptId?: string;
    executionActivationRecordId?: string;
    activationRuntimeLinkId?: string;
    feedbackClass: string;
    reasonTokens?: string[];
    linkedRuntimeIds?: {
      executionAttemptId?: string | null;
      taskExecutionRunId?: string | null;
      workerResultId?: string | null;
    };
  }>;
}): RuntimeFeedbackIngestionRecord[] {
  const attemptsById = new Map(input.dispatchAttempts.map((entry) => [entry.activationDispatchAttemptId, entry]));
  const attemptsByActivationId = new Map(input.dispatchAttempts.map((entry) => [entry.executionActivationRecordId, entry]));

  const records = (input.feedbackRecords ?? [])
    .map((record) => {
      const attempt = (record.activationDispatchAttemptId
        ? attemptsById.get(record.activationDispatchAttemptId)
        : undefined)
        ?? (record.executionActivationRecordId
          ? attemptsByActivationId.get(record.executionActivationRecordId)
          : undefined)
        ?? null;

      if (!attempt) {
        return null;
      }

      const linkedRuntimeIds = normalizeRuntimeLinkedIds({
        executionAttemptId: record.linkedRuntimeIds?.executionAttemptId ?? null,
        taskExecutionRunId: record.linkedRuntimeIds?.taskExecutionRunId ?? null,
        workerResultId: record.linkedRuntimeIds?.workerResultId ?? null,
      });
      const feedbackClass = normalizeRuntimeFeedbackClass(record.feedbackClass);
      const activationRuntimeLinkId = record.activationRuntimeLinkId ?? deriveActivationRuntimeLinkId({
        activationDispatchAttemptId: attempt.activationDispatchAttemptId,
        executionActivationRecordId: attempt.executionActivationRecordId,
        executionAttemptId: linkedRuntimeIds.executionAttemptId,
        taskExecutionRunId: linkedRuntimeIds.taskExecutionRunId,
        workerResultId: linkedRuntimeIds.workerResultId,
        runtimeLinkClass: feedbackClass === 'runtime_dispatch_accepted'
          ? 'dispatch_submitted'
          : (feedbackClass === 'runtime_execution_started'
              ? 'runtime_started'
              : (feedbackClass === 'runtime_execution_completed'
                  ? 'runtime_completed'
                  : (feedbackClass === 'runtime_execution_retrying'
                      ? 'runtime_retrying'
                      : (feedbackClass === 'runtime_execution_inconclusive'
                          ? 'runtime_inconclusive'
                          : 'runtime_failed')))),
      });

      const reasonTokens = uniqueSortedStrings(record.reasonTokens);
      return {
        runtimeFeedbackIngestionRecordId: deriveRuntimeFeedbackIngestionRecordId({
          activationDispatchAttemptId: attempt.activationDispatchAttemptId,
          activationRuntimeLinkId,
          feedbackClass,
          reasonTokens,
          linkedRuntimeIds,
        }),
        activationDispatchAttemptId: attempt.activationDispatchAttemptId,
        activationRuntimeLinkId,
        feedbackClass,
        reasonTokens,
        linkedRuntimeIds,
        state: 'ingested',
      } satisfies RuntimeFeedbackIngestionRecord;
    })
    .filter((entry): entry is RuntimeFeedbackIngestionRecord => entry !== null);

  const deduped = new Map(records.map((entry) => [entry.runtimeFeedbackIngestionRecordId, entry]));
  return Array.from(deduped.values())
    .sort((left, right) => left.runtimeFeedbackIngestionRecordId.localeCompare(right.runtimeFeedbackIngestionRecordId));
}
