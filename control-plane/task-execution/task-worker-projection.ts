import type {
  MissionTaskExecutionHistoryEntry,
  MissionTaskWorkerExecutionState,
  WorkerFailureClass,
  WorkerResultType,
} from './task-execution-step-types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function asResultType(value: unknown): WorkerResultType | null {
  if (value === 'SUCCESS' || value === 'FAILURE' || value === 'RETRY_REQUESTED') {
    return value;
  }

  return null;
}

function asFailureClass(value: unknown): WorkerFailureClass | null {
  if (
    value === 'RETRYABLE_FAILURE'
    || value === 'NON_RETRYABLE_FAILURE'
    || value === 'SYSTEM_FAILURE'
    || value === 'POLICY_FAILURE'
    || value === 'DEPENDENCY_FAILURE'
  ) {
    return value;
  }

  return null;
}

function compareWorkerState(
  left: MissionTaskWorkerExecutionState,
  right: MissionTaskWorkerExecutionState,
): number {
  const byNode = left.taskNodeId.localeCompare(right.taskNodeId);
  if (byNode !== 0) {
    return byNode;
  }

  const byAttempt = left.attemptIndex - right.attemptIndex;
  if (byAttempt !== 0) {
    return byAttempt;
  }

  const byWorker = left.workerId.localeCompare(right.workerId);
  if (byWorker !== 0) {
    return byWorker;
  }

  return left.claimId.localeCompare(right.claimId);
}

function parseClaimPayload(payload: unknown): {
  executionRunId: string;
  taskGraphId: string;
  taskNodeId: string;
  workerId: string;
  claimId: string;
  claimAttemptIndex: number;
  attemptIndex: number;
} | null {
  if (!isRecord(payload)) {
    return null;
  }

  const executionRunId = asString(payload.executionRunId);
  const taskGraphId = asString(payload.taskGraphId);
  const taskNodeId = asString(payload.taskNodeId);
  const workerId = asString(payload.workerId);
  const claimId = asString(payload.claimId);
  const claimAttemptIndex = asInteger(payload.claimAttemptIndex);
  const attemptIndex = asInteger(payload.attemptIndex);

  if (!executionRunId || !taskGraphId || !taskNodeId || !workerId || !claimId) {
    return null;
  }

  if (claimAttemptIndex === null || attemptIndex === null || claimAttemptIndex < 0 || attemptIndex < 0) {
    return null;
  }

  return {
    executionRunId,
    taskGraphId,
    taskNodeId,
    workerId,
    claimId,
    claimAttemptIndex,
    attemptIndex,
  };
}

function parseExecutionPayload(payload: unknown): {
  executionRunId: string;
  taskGraphId: string;
  taskNodeId: string;
  workerId: string;
  claimId: string;
  attemptIndex: number;
  resultType: WorkerResultType | null;
  failureClass: WorkerFailureClass | null;
  retryEligible: boolean | null;
} | null {
  if (!isRecord(payload)) {
    return null;
  }

  const executionRunId = asString(payload.executionRunId);
  const taskGraphId = asString(payload.taskGraphId);
  const taskNodeId = asString(payload.taskNodeId);
  const workerId = asString(payload.workerId);
  const claimId = asString(payload.claimId);
  const attemptIndex = asInteger(payload.attemptIndex);

  if (!executionRunId || !taskGraphId || !taskNodeId || !workerId || !claimId) {
    return null;
  }

  if (attemptIndex === null || attemptIndex < 0) {
    return null;
  }

  const retryEligible = typeof payload.retryEligible === 'boolean' ? payload.retryEligible : null;

  return {
    executionRunId,
    taskGraphId,
    taskNodeId,
    workerId,
    claimId,
    attemptIndex,
    resultType: asResultType(payload.resultType),
    failureClass: asFailureClass(payload.failureClass),
    retryEligible,
  };
}

function stateKey(input: {
  taskNodeId: string;
  attemptIndex: number;
  workerId: string;
  claimId: string;
}): string {
  return `${input.taskNodeId}::${String(input.attemptIndex)}::${input.workerId}::${input.claimId}`;
}

export function deriveTaskWorkerProjection(input: {
  historyEntries: MissionTaskExecutionHistoryEntry[];
}) {
  const workerHistory = input.historyEntries
    .filter((entry) => (
      entry.eventType === 'worker_registered'
      || entry.eventType === 'task_node_claimed'
      || entry.eventType === 'worker_execution_started'
      || entry.eventType === 'worker_execution_completed'
      || entry.eventType === 'worker_execution_failed'
    ))
    .sort((left, right) => left.eventIndex - right.eventIndex);

  const assignments = new Map<string, Set<string>>();
  const stateByKey = new Map<string, MissionTaskWorkerExecutionState>();
  const claimedNodeIds = new Set<string>();

  for (const entry of workerHistory) {
    if (entry.eventType === 'worker_registered') {
      continue;
    }

    if (entry.eventType === 'task_node_claimed') {
      const parsed = parseClaimPayload(entry.eventPayload);
      if (!parsed) {
        continue;
      }

      const assignment = assignments.get(parsed.workerId) ?? new Set<string>();
      assignment.add(parsed.taskNodeId);
      assignments.set(parsed.workerId, assignment);

      claimedNodeIds.add(parsed.taskNodeId);

      const key = stateKey({
        taskNodeId: parsed.taskNodeId,
        attemptIndex: parsed.attemptIndex,
        workerId: parsed.workerId,
        claimId: parsed.claimId,
      });

      stateByKey.set(key, {
        executionRunId: parsed.executionRunId,
        taskGraphId: parsed.taskGraphId,
        taskNodeId: parsed.taskNodeId,
        workerId: parsed.workerId,
        claimId: parsed.claimId,
        attemptIndex: parsed.attemptIndex,
        state: 'claimed',
      });
      continue;
    }

    if (entry.eventType === 'worker_execution_started') {
      const parsed = parseExecutionPayload(entry.eventPayload);
      if (!parsed) {
        continue;
      }

      const key = stateKey({
        taskNodeId: parsed.taskNodeId,
        attemptIndex: parsed.attemptIndex,
        workerId: parsed.workerId,
        claimId: parsed.claimId,
      });

      const current = stateByKey.get(key);
      stateByKey.set(key, {
        executionRunId: parsed.executionRunId,
        taskGraphId: parsed.taskGraphId,
        taskNodeId: parsed.taskNodeId,
        workerId: parsed.workerId,
        claimId: parsed.claimId,
        attemptIndex: parsed.attemptIndex,
        state: 'running',
        ...(current?.resultType ? { resultType: current.resultType } : {}),
        ...(current?.failureClass ? { failureClass: current.failureClass } : {}),
        ...(current?.retryEligible !== undefined ? { retryEligible: current.retryEligible } : {}),
      });
      continue;
    }

    if (entry.eventType === 'worker_execution_completed') {
      const parsed = parseExecutionPayload(entry.eventPayload);
      if (!parsed) {
        continue;
      }

      const key = stateKey({
        taskNodeId: parsed.taskNodeId,
        attemptIndex: parsed.attemptIndex,
        workerId: parsed.workerId,
        claimId: parsed.claimId,
      });

      stateByKey.set(key, {
        executionRunId: parsed.executionRunId,
        taskGraphId: parsed.taskGraphId,
        taskNodeId: parsed.taskNodeId,
        workerId: parsed.workerId,
        claimId: parsed.claimId,
        attemptIndex: parsed.attemptIndex,
        state: 'completed',
        resultType: 'SUCCESS',
      });
      continue;
    }

    if (entry.eventType === 'worker_execution_failed') {
      const parsed = parseExecutionPayload(entry.eventPayload);
      if (!parsed) {
        continue;
      }

      const key = stateKey({
        taskNodeId: parsed.taskNodeId,
        attemptIndex: parsed.attemptIndex,
        workerId: parsed.workerId,
        claimId: parsed.claimId,
      });

      stateByKey.set(key, {
        executionRunId: parsed.executionRunId,
        taskGraphId: parsed.taskGraphId,
        taskNodeId: parsed.taskNodeId,
        workerId: parsed.workerId,
        claimId: parsed.claimId,
        attemptIndex: parsed.attemptIndex,
        state: 'failed',
        ...(parsed.resultType ? { resultType: parsed.resultType } : {}),
        ...(parsed.failureClass ? { failureClass: parsed.failureClass } : {}),
        ...(parsed.retryEligible !== null ? { retryEligible: parsed.retryEligible } : {}),
      });
    }
  }

  const workerAssignments = Object.fromEntries(
    [...assignments.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([workerId, nodeIds]) => [workerId, [...nodeIds].sort((left, right) => left.localeCompare(right))]),
  );

  const workerExecutionState = Object.fromEntries(
    [...stateByKey.entries()]
      .sort(([, left], [, right]) => compareWorkerState(left, right))
      .map(([key, value]) => [key, value]),
  );

  const activeWorkerCount = Object.values(workerExecutionState)
    .filter((state) => state.state === 'claimed' || state.state === 'running')
    .map((state) => state.workerId)
    .filter((workerId, index, all) => all.indexOf(workerId) === index)
    .length;

  return {
    claimedNodeCount: claimedNodeIds.size,
    activeWorkerCount,
    workerAssignments,
    workerExecutionState,
    workerHistory,
  };
}
