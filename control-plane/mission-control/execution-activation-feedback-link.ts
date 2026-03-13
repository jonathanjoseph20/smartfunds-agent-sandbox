import {
  deriveExecutionActivationFeedbackLinkId,
  uniqueSortedStrings,
} from './mission-execution-activation-identity.ts';
import type {
  ExecutionActivationFeedbackClass,
  ExecutionActivationFeedbackLink,
} from './mission-execution-activation-types.ts';
import type { ExecutionActivationRecord } from './mission-execution-activation-types.ts';

export function deriveExecutionActivationFeedbackLinks(input: {
  activationRecords: ExecutionActivationRecord[];
  feedbackRecords?: Array<{
    executionActivationRecordId?: string;
    executionRequestRecordId: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    feedbackClass: ExecutionActivationFeedbackClass;
  }>;
}): ExecutionActivationFeedbackLink[] {
  const activationByRequestId = new Map(
    input.activationRecords.map((entry) => [entry.executionRequestRecordId, entry])
  );

  const links = (input.feedbackRecords ?? [])
    .map((record) => {
      const activation = record.executionActivationRecordId
        ? input.activationRecords.find((entry) => entry.executionActivationRecordId === record.executionActivationRecordId) ?? null
        : (activationByRequestId.get(record.executionRequestRecordId) ?? null);

      if (!activation) {
        return null;
      }

      return {
        executionActivationFeedbackLinkId: deriveExecutionActivationFeedbackLinkId({
          executionActivationRecordId: activation.executionActivationRecordId,
          executionRequestRecordId: activation.executionRequestRecordId,
          executionAttemptId: record.executionAttemptId ?? null,
          taskExecutionRunId: record.taskExecutionRunId ?? null,
          workerResultId: record.workerResultId ?? null,
          feedbackClass: record.feedbackClass,
        }),
        executionActivationRecordId: activation.executionActivationRecordId,
        executionRequestRecordId: activation.executionRequestRecordId,
        executionAttemptId: record.executionAttemptId ?? null,
        taskExecutionRunId: record.taskExecutionRunId ?? null,
        workerResultId: record.workerResultId ?? null,
        feedbackClass: record.feedbackClass,
        state: 'linked',
      } satisfies ExecutionActivationFeedbackLink;
    })
    .filter((entry): entry is ExecutionActivationFeedbackLink => entry !== null);

  const deduped = new Map(links.map((entry) => [entry.executionActivationFeedbackLinkId, entry]));
  return Array.from(deduped.values())
    .sort((left, right) => left.executionActivationFeedbackLinkId.localeCompare(right.executionActivationFeedbackLinkId));
}

export function summarizeLinkedExecutionAttemptIds(links: ExecutionActivationFeedbackLink[]): string[] {
  return uniqueSortedStrings(
    links.map((entry) => entry.executionAttemptId ?? '').filter((entry) => entry.length > 0)
  );
}
