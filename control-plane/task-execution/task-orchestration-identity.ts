import { canonicalStringify, sha256 } from '../finance/determinism.ts';

export function deriveOrchestrationCycleId(input: {
  executionRunId: string;
  taskGraphId: string;
  cycleIndex: number;
  workerSchedulingPolicyId: string;
  runnableNodeIds: string[];
  eligibleWorkerIds: string[];
}): string {
  return sha256(canonicalStringify({
    executionRunId: input.executionRunId,
    taskGraphId: input.taskGraphId,
    cycleIndex: input.cycleIndex,
    workerSchedulingPolicyId: input.workerSchedulingPolicyId,
    runnableNodeIds: [...input.runnableNodeIds].sort((left, right) => left.localeCompare(right)),
    eligibleWorkerIds: [...input.eligibleWorkerIds].sort((left, right) => left.localeCompare(right)),
  }));
}

export function deriveWorkerQueueEntryId(input: {
  executionRunId: string;
  workerId: string;
  taskNodeId: string;
  assignmentDecisionId: string;
  queueIndex: number;
}): string {
  return sha256(canonicalStringify({
    executionRunId: input.executionRunId,
    workerId: input.workerId,
    taskNodeId: input.taskNodeId,
    assignmentDecisionId: input.assignmentDecisionId,
    queueIndex: input.queueIndex,
  }));
}

export function deriveTaskOrchestrationEventDedupeKey(input: {
  executionRunId: string;
  taskGraphId: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    executionRunId: input.executionRunId,
    taskGraphId: input.taskGraphId,
    eventType: input.eventType,
    eventPayload: JSON.parse(canonicalStringify(input.eventPayload)),
  }));
}
