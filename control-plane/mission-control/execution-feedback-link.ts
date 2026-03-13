import {
  deriveExecutionFeedbackLinkId,
  uniqueSortedStrings,
} from './mission-execution-coordination-identity.ts';
import type {
  ExecutionFeedbackClass,
  ExecutionFeedbackLink,
  ExecutionRequestRecord,
} from './mission-execution-coordination-types.ts';

export function deriveExecutionFeedbackLinks(input: {
  missionExecutionCoordinationPlanId: string;
  requests: ExecutionRequestRecord[];
  feedbackRecords?: Array<{
    executionRequestRecordId: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    feedbackClass: ExecutionFeedbackClass;
  }>;
}): ExecutionFeedbackLink[] {
  const byRequestId = new Map(input.requests.map((entry) => [entry.executionRequestRecordId, entry]));

  const links = (input.feedbackRecords ?? [])
    .map((record) => {
      const request = byRequestId.get(record.executionRequestRecordId);
      if (!request) {
        return null;
      }

      return {
        executionFeedbackLinkId: deriveExecutionFeedbackLinkId({
          executionRequestRecordId: request.executionRequestRecordId,
          executionAttemptId: record.executionAttemptId ?? null,
          taskExecutionRunId: record.taskExecutionRunId ?? null,
          workerResultId: record.workerResultId ?? null,
          missionControlOrchestrationActionItemId: request.missionControlOrchestrationActionItemId,
          missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
          feedbackClass: record.feedbackClass,
        }),
        executionRequestRecordId: request.executionRequestRecordId,
        executionAttemptId: record.executionAttemptId ?? null,
        taskExecutionRunId: record.taskExecutionRunId ?? null,
        workerResultId: record.workerResultId ?? null,
        missionControlOrchestrationActionItemId: request.missionControlOrchestrationActionItemId,
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
        feedbackClass: record.feedbackClass,
        state: 'linked',
      } satisfies ExecutionFeedbackLink;
    })
    .filter((entry): entry is ExecutionFeedbackLink => entry !== null);

  const deduped = new Map(links.map((entry) => [entry.executionFeedbackLinkId, entry]));
  return Array.from(deduped.values())
    .sort((left, right) => left.executionFeedbackLinkId.localeCompare(right.executionFeedbackLinkId));
}

export function summarizeLinkedExecutionAttemptIds(links: ExecutionFeedbackLink[]): string[] {
  return uniqueSortedStrings(links.map((entry) => entry.executionAttemptId ?? '').filter((entry) => entry.length > 0));
}
