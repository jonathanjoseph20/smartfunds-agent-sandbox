import { WorkflowDag } from '../workflows/workflow-dag.ts';
import type { ValidatedWorkflowDefinition } from '../workflows/workflow-types.ts';

export type RetryQueueItem = {
  runId: string;
  workflowId: string;
  nodeId: string;
  retryAttempt: number;
  scheduledTick: number;
};

function sortRetryQueueItems(queue: RetryQueueItem[]): RetryQueueItem[] {
  return [...queue].sort((left, right) => {
    const tickCmp = left.scheduledTick - right.scheduledTick;
    if (tickCmp !== 0) {
      return tickCmp;
    }

    const nodeCmp = left.nodeId.localeCompare(right.nodeId);
    if (nodeCmp !== 0) {
      return nodeCmp;
    }

    return left.retryAttempt - right.retryAttempt;
  });
}

export function sortRetryQueue(queue: RetryQueueItem[]): RetryQueueItem[] {
  return sortRetryQueueItems(queue);
}

export function dependenciesSatisfiedForRetry(input: {
  workflow: ValidatedWorkflowDefinition;
  nodeId: string;
  completedNodeIds: string[];
}): boolean {
  const dag = new WorkflowDag(input.workflow);
  const runnable = dag.getRunnableNodeIds(input.completedNodeIds);
  return runnable.includes(input.nodeId);
}

export function scheduleRetry(input: {
  queue: RetryQueueItem[];
  runId: string;
  workflowId: string;
  nodeId: string;
  retryAttempt: number;
  currentTick: number;
  tickDelay: number;
}): RetryQueueItem[] {
  const scheduledTick = input.currentTick + input.tickDelay;
  const deduped = input.queue.filter((item) => !(item.nodeId === input.nodeId && item.retryAttempt === input.retryAttempt));

  const next = [
    ...deduped,
    {
      runId: input.runId,
      workflowId: input.workflowId,
      nodeId: input.nodeId,
      retryAttempt: input.retryAttempt,
      scheduledTick
    }
  ];

  return sortRetryQueueItems(next);
}

export function collectReadyRetries(input: {
  queue: RetryQueueItem[];
  currentTick: number;
  workflow: ValidatedWorkflowDefinition;
  completedNodeIds: string[];
}): RetryQueueItem[] {
  return sortRetryQueueItems(input.queue)
    .filter((item) => item.scheduledTick <= input.currentTick)
    .filter((item) => dependenciesSatisfiedForRetry({
      workflow: input.workflow,
      nodeId: item.nodeId,
      completedNodeIds: input.completedNodeIds
    }));
}
