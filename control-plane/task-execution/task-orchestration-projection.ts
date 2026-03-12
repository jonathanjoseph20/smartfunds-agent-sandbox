import { loadWorkerRegistry, type WorkerRegistry } from '../workers/worker-registry.ts';
import {
  createTaskExecutionHistoryStore,
  type TaskExecutionHistoryStore,
} from './task-execution-history-store.ts';
import {
  createTaskOrchestrationHistoryStore,
  type TaskOrchestrationHistoryStore,
} from './task-orchestration-history-store.ts';
import { deriveTaskWorkerQueueState } from './task-worker-queue.ts';
import type {
  AssignmentDeferralReason,
  ExecutionOrchestrationCycle,
  TaskOrchestrationProjection,
  WorkerAssignmentDecision,
} from './task-orchestration-types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string').sort((left, right) => left.localeCompare(right));
}

function asInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function asCycleState(value: unknown): ExecutionOrchestrationCycle['cycleState'] {
  if (
    value === 'evaluating'
    || value === 'assigning'
    || value === 'waiting_on_results'
    || value === 'completed'
    || value === 'blocked'
    || value === 'incomplete'
  ) {
    return value;
  }

  return 'incomplete';
}

function asAssignmentState(value: unknown): WorkerAssignmentDecision['assignmentState'] {
  if (
    value === 'assigned'
    || value === 'deferred'
    || value === 'rejected'
    || value === 'incompatible'
    || value === 'capacity_exhausted'
    || value === 'worker_unavailable'
  ) {
    return value;
  }

  return 'deferred';
}

function normalizeDeferralReasons(values: string[]): AssignmentDeferralReason[] {
  return values
    .filter((value): value is AssignmentDeferralReason => (
      value === 'no_compatible_worker'
      || value === 'no_capacity'
      || value === 'worker_disabled'
      || value === 'worker_paused'
      || value === 'worker_unavailable'
      || value === 'deterministic_ordering_deferred'
    ))
    .sort((left, right) => left.localeCompare(right));
}

function compareCycles(left: ExecutionOrchestrationCycle, right: ExecutionOrchestrationCycle): number {
  const byIndex = left.cycleIndex - right.cycleIndex;
  if (byIndex !== 0) {
    return byIndex;
  }

  return left.orchestrationCycleId.localeCompare(right.orchestrationCycleId);
}

function compareAssignments(left: WorkerAssignmentDecision, right: WorkerAssignmentDecision): number {
  const byCycle = left.cycleIndex - right.cycleIndex;
  if (byCycle !== 0) {
    return byCycle;
  }

  const byNode = left.taskNodeId.localeCompare(right.taskNodeId);
  if (byNode !== 0) {
    return byNode;
  }

  const byWorker = (left.workerId ?? '').localeCompare(right.workerId ?? '');
  if (byWorker !== 0) {
    return byWorker;
  }

  return left.assignmentDecisionId.localeCompare(right.assignmentDecisionId);
}

function parseCycle(payload: unknown): ExecutionOrchestrationCycle | null {
  if (!isRecord(payload)) {
    return null;
  }

  const executionRunId = asString(payload.executionRunId);
  const taskGraphId = asString(payload.taskGraphId);
  const orchestrationCycleId = asString(payload.orchestrationCycleId);
  const cycleIndex = asInteger(payload.cycleIndex);
  const workerSchedulingPolicyId = asString(payload.workerSchedulingPolicyId);

  if (!executionRunId || !taskGraphId || !orchestrationCycleId || cycleIndex === null || !workerSchedulingPolicyId) {
    return null;
  }

  return {
    orchestrationCycleId,
    executionRunId,
    taskGraphId,
    cycleIndex,
    workerSchedulingPolicyId,
    runnableNodeIds: asStringArray(payload.runnableNodeIds),
    eligibleWorkerIds: asStringArray(payload.eligibleWorkerIds),
    assignmentDecisionIds: asStringArray(payload.assignmentDecisionIds),
    deferredNodeIds: asStringArray(payload.deferredNodeIds),
    completedAssignmentCount: asInteger(payload.completedAssignmentCount) ?? 0,
    queueUpdates: asInteger(payload.queueUpdates) ?? 0,
    cycleState: asCycleState(payload.cycleState),
  };
}

function parseDecision(payload: unknown): WorkerAssignmentDecision | null {
  if (!isRecord(payload)) {
    return null;
  }

  const assignmentDecisionId = asString(payload.assignmentDecisionId);
  const executionRunId = asString(payload.executionRunId);
  const taskNodeId = asString(payload.taskNodeId);
  const cycleIndex = asInteger(payload.cycleIndex);
  const policyId = asString(payload.policyId);

  if (!assignmentDecisionId || !executionRunId || !taskNodeId || cycleIndex === null || !policyId) {
    return null;
  }

  const workerId = payload.workerId === null ? null : asString(payload.workerId);
  if (payload.workerId !== null && !workerId) {
    return null;
  }

  const compatibility = isRecord(payload.workerCompatibilitySummary) ? payload.workerCompatibilitySummary : {};
  const capacity = isRecord(payload.workerCapacitySummary) ? payload.workerCapacitySummary : {};

  return {
    assignmentDecisionId,
    executionRunId,
    taskNodeId,
    workerId,
    cycleIndex,
    assignmentState: asAssignmentState(payload.assignmentState),
    selectionReasonTokens: asStringArray(payload.selectionReasonTokens),
    deferralReasonTokens: normalizeDeferralReasons(asStringArray(payload.deferralReasonTokens)),
    workerCompatibilitySummary: {
      compatibleWorkerIds: asStringArray(compatibility.compatibleWorkerIds),
      incompatibleWorkerIds: asStringArray(compatibility.incompatibleWorkerIds),
    },
    workerCapacitySummary: {
      workerId: capacity.workerId === null ? null : asString(capacity.workerId),
      maxConcurrentAssignments: asInteger(capacity.maxConcurrentAssignments) ?? 0,
      currentAssignedCount: asInteger(capacity.currentAssignedCount) ?? 0,
      remainingCapacity: asInteger(capacity.remainingCapacity) ?? 0,
    },
    alternativesConsidered: asStringArray(payload.alternativesConsidered),
    policyId,
  };
}

export function createTaskOrchestrationProjection(options: {
  historyStore?: TaskOrchestrationHistoryStore;
  taskExecutionHistoryStore?: TaskExecutionHistoryStore;
  workerRegistry?: WorkerRegistry;
  taskExecutionArtifactsRoot?: string;
  workerDefinitionsDir?: string;
} = {}) {
  const historyStore = options.historyStore ?? createTaskOrchestrationHistoryStore({
    artifactsRoot: options.taskExecutionArtifactsRoot,
  });
  const taskExecutionHistoryStore = options.taskExecutionHistoryStore ?? createTaskExecutionHistoryStore({
    artifactsRoot: options.taskExecutionArtifactsRoot,
  });
  const workerRegistry = options.workerRegistry ?? loadWorkerRegistry({
    definitionsDir: options.workerDefinitionsDir,
  });

  function projectOne(input: { executionRunId: string; taskGraphId: string }): TaskOrchestrationProjection {
    const orchestrationHistory = historyStore.load(input);
    const executionHistory = taskExecutionHistoryStore.load({
      executionEngineRunId: input.executionRunId,
      executionAttemptId: '',
      taskGraphId: input.taskGraphId,
    });

    const cyclesById = new Map<string, ExecutionOrchestrationCycle>();
    const assignmentsById = new Map<string, WorkerAssignmentDecision>();

    for (const entry of [...orchestrationHistory.entries].sort((left, right) => left.eventIndex - right.eventIndex)) {
      if (entry.eventType === 'orchestration_cycle_started' || entry.eventType === 'orchestration_cycle_completed') {
        const cycle = parseCycle(entry.eventPayload.cycle ?? entry.eventPayload);
        if (!cycle) {
          continue;
        }

        cyclesById.set(cycle.orchestrationCycleId, cycle);
      }

      if (
        entry.eventType === 'worker_assignment_evaluated'
        || entry.eventType === 'worker_assignment_created'
        || entry.eventType === 'worker_assignment_deferred'
      ) {
        const assignment = parseDecision(entry.eventPayload.assignmentDecision ?? entry.eventPayload);
        if (!assignment) {
          continue;
        }

        assignmentsById.set(assignment.assignmentDecisionId, assignment);
      }
    }

    const cycles = [...cyclesById.values()].sort(compareCycles);
    const assignments = [...assignmentsById.values()].sort(compareAssignments);

    const workerQueues = deriveTaskWorkerQueueState({
      executionRunId: input.executionRunId,
      workerDefinitions: workerRegistry.listWorkers(),
      orchestrationEntries: orchestrationHistory.entries,
      executionEntries: executionHistory.entries,
    });

    const deferredByNode = new Map<string, Set<AssignmentDeferralReason>>();
    for (const decision of assignments) {
      if (decision.deferralReasonTokens.length === 0) {
        continue;
      }

      const current = deferredByNode.get(decision.taskNodeId) ?? new Set<AssignmentDeferralReason>();
      for (const reason of decision.deferralReasonTokens) {
        current.add(reason);
      }
      deferredByNode.set(decision.taskNodeId, current);
    }

    const deferredNodes = [...deferredByNode.entries()]
      .map(([taskNodeId, reasons]) => ({
        taskNodeId,
        reasonTokens: [...reasons].sort((left, right) => left.localeCompare(right)),
      }))
      .sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId));

    const workerLoad = workerQueues
      .map((workerQueue) => ({
        workerId: workerQueue.workerId,
        status: workerQueue.status,
        maxConcurrentAssignments: workerQueue.maxConcurrentAssignments,
        currentAssignedCount: workerQueue.currentAssignedCount,
        remainingCapacity: workerQueue.summary.remainingCapacity,
      }))
      .sort((left, right) => left.workerId.localeCompare(right.workerId));

    const currentCycleIndex = cycles.length > 0 ? cycles[cycles.length - 1]!.cycleIndex : 0;
    const cycleState = cycles.length > 0 ? cycles[cycles.length - 1]!.cycleState : 'incomplete';

    return {
      executionRunId: input.executionRunId,
      taskGraphId: input.taskGraphId,
      currentCycleIndex,
      cycleState,
      cycles,
      assignments,
      deferredNodes,
      workerQueues,
      workerLoad,
    };
  }

  return {
    projectOne,
  };
}

export type TaskOrchestrationProjectionEngine = ReturnType<typeof createTaskOrchestrationProjection>;
