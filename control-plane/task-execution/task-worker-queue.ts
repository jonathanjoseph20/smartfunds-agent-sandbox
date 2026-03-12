import type { WorkerDefinition } from '../workers/worker-types.ts';
import type { MissionTaskExecutionHistoryEntry } from './task-execution-step-types.ts';
import { deriveWorkerQueueEntryId } from './task-orchestration-identity.ts';
import type {
  TaskOrchestrationHistoryEntry,
  WorkerQueueEntry,
  WorkerQueueProjectionState,
  WorkerQueueState,
} from './task-orchestration-types.ts';

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function queueStateRank(state: WorkerQueueState): number {
  switch (state) {
    case 'queued':
      return 0;
    case 'claimed':
      return 1;
    case 'running':
      return 2;
    case 'completed':
      return 3;
    case 'failed':
      return 4;
    case 'cancelled':
      return 5;
    default:
      return 6;
  }
}

function compareQueueEntry(left: WorkerQueueEntry, right: WorkerQueueEntry): number {
  const byWorker = left.workerId.localeCompare(right.workerId);
  if (byWorker !== 0) {
    return byWorker;
  }

  const byIndex = left.queueIndex - right.queueIndex;
  if (byIndex !== 0) {
    return byIndex;
  }

  const byState = queueStateRank(left.queueState) - queueStateRank(right.queueState);
  if (byState !== 0) {
    return byState;
  }

  return left.taskNodeId.localeCompare(right.taskNodeId);
}

function compareWorkerQueueState(left: WorkerQueueProjectionState, right: WorkerQueueProjectionState): number {
  return left.workerId.localeCompare(right.workerId);
}

type QueueIdentity = {
  workerId: string;
  taskNodeId: string;
  assignmentDecisionId: string;
};

function queueKey(value: QueueIdentity): string {
  return `${value.workerId}::${value.taskNodeId}::${value.assignmentDecisionId}`;
}

function updateQueueState(
  value: WorkerQueueEntry,
  queueState: WorkerQueueState,
): WorkerQueueEntry {
  return {
    ...value,
    queueState,
  };
}

export function deriveTaskWorkerQueueState(input: {
  executionRunId: string;
  workerDefinitions: WorkerDefinition[];
  orchestrationEntries: TaskOrchestrationHistoryEntry[];
  executionEntries: MissionTaskExecutionHistoryEntry[];
}): WorkerQueueProjectionState[] {
  const queueByKey = new Map<string, WorkerQueueEntry>();
  const queueCounterByWorker = new Map<string, number>();

  const orderedOrchestrationEntries = [...input.orchestrationEntries].sort((left, right) => left.eventIndex - right.eventIndex);

  for (const entry of orderedOrchestrationEntries) {
    if (entry.eventType !== 'worker_assignment_created' && entry.eventType !== 'worker_queue_updated') {
      continue;
    }

    const workerId = asString(entry.eventPayload.workerId);
    const taskNodeId = asString(entry.eventPayload.taskNodeId);
    const assignmentDecisionId = asString(entry.eventPayload.assignmentDecisionId);

    if (!workerId || !taskNodeId || !assignmentDecisionId) {
      continue;
    }

    const key = queueKey({ workerId, taskNodeId, assignmentDecisionId });
    if (queueByKey.has(key)) {
      continue;
    }

    const currentIndex = queueCounterByWorker.get(workerId) ?? 0;
    queueCounterByWorker.set(workerId, currentIndex + 1);

    queueByKey.set(key, {
      queueEntryId: deriveWorkerQueueEntryId({
        executionRunId: input.executionRunId,
        workerId,
        taskNodeId,
        assignmentDecisionId,
        queueIndex: currentIndex,
      }),
      workerId,
      taskNodeId,
      executionRunId: input.executionRunId,
      assignmentDecisionId,
      queueIndex: currentIndex,
      queueState: 'queued',
    });
  }

  const orderedExecutionEntries = [...input.executionEntries].sort((left, right) => left.eventIndex - right.eventIndex);

  for (const entry of orderedExecutionEntries) {
    if (entry.eventType === 'task_node_claimed') {
      const workerId = asString(entry.eventPayload.workerId);
      const taskNodeId = asString(entry.eventPayload.taskNodeId);
      if (!workerId || !taskNodeId) {
        continue;
      }

      const target = [...queueByKey.values()]
        .sort(compareQueueEntry)
        .find((queue) => queue.workerId === workerId && queue.taskNodeId === taskNodeId && queue.queueState === 'queued');

      if (!target) {
        continue;
      }

      queueByKey.set(queueKey(target), updateQueueState(target, 'claimed'));
      continue;
    }

    if (entry.eventType === 'worker_execution_started') {
      const workerId = asString(entry.eventPayload.workerId);
      const taskNodeId = asString(entry.eventPayload.taskNodeId);
      if (!workerId || !taskNodeId) {
        continue;
      }

      const target = [...queueByKey.values()]
        .sort(compareQueueEntry)
        .find((queue) => queue.workerId === workerId && queue.taskNodeId === taskNodeId && queue.queueState === 'claimed');

      if (!target) {
        continue;
      }

      queueByKey.set(queueKey(target), updateQueueState(target, 'running'));
      continue;
    }

    if (entry.eventType === 'worker_execution_completed' || entry.eventType === 'worker_execution_failed') {
      const workerId = asString(entry.eventPayload.workerId);
      const taskNodeId = asString(entry.eventPayload.taskNodeId);
      if (!workerId || !taskNodeId) {
        continue;
      }

      const target = [...queueByKey.values()]
        .sort(compareQueueEntry)
        .find((queue) => (
          queue.workerId === workerId
          && queue.taskNodeId === taskNodeId
          && (queue.queueState === 'running' || queue.queueState === 'claimed')
        ));

      if (!target) {
        continue;
      }

      queueByKey.set(queueKey(target), updateQueueState(target, entry.eventType === 'worker_execution_completed' ? 'completed' : 'failed'));
    }
  }

  const queuesByWorker = new Map<string, WorkerQueueEntry[]>();
  for (const entry of [...queueByKey.values()].sort(compareQueueEntry)) {
    const current = queuesByWorker.get(entry.workerId) ?? [];
    current.push(entry);
    queuesByWorker.set(entry.workerId, current);
  }

  const workerState = input.workerDefinitions
    .sort((left, right) => left.workerId.localeCompare(right.workerId))
    .map((worker) => {
      const queue = [...(queuesByWorker.get(worker.workerId) ?? [])].sort(compareQueueEntry);
      const inFlight = queue.filter((entry) => (
        entry.queueState === 'claimed'
        || entry.queueState === 'running'
      )).length;
      const completed = queue.filter((entry) => entry.queueState === 'completed').length;
      const queued = queue.filter((entry) => entry.queueState === 'queued').length;

      return {
        workerId: worker.workerId,
        status: worker.status,
        maxConcurrentAssignments: worker.maxConcurrentAssignments,
        currentAssignedCount: inFlight,
        queue,
        summary: {
          totalQueued: queued,
          inFlight,
          completed,
          remainingCapacity: Math.max(worker.maxConcurrentAssignments - inFlight, 0),
        },
      } as WorkerQueueProjectionState;
    })
    .sort(compareWorkerQueueState);

  return workerState;
}

export function readQueueIndex(input: { queueEntry: WorkerQueueEntry }): number {
  const queueIndex = asInteger(input.queueEntry.queueIndex);
  return queueIndex ?? Number.MAX_SAFE_INTEGER;
}
