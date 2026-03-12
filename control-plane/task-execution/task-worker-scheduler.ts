import type { WorkerDefinition } from '../workers/worker-types.ts';
import type { MissionTaskNode } from '../task-graph/task-graph-types.ts';

import {
  deriveAssignmentDecisionId,
  normalizeAssignmentDecision,
} from './task-assignment-decision.ts';
import type {
  AssignmentDeferralReason,
  WorkerAssignmentDecision,
  WorkerSchedulingPolicy,
} from './task-orchestration-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function compareByLexical(left: string, right: string): number {
  return left.localeCompare(right);
}

function buildPredecessors(input: { edges: Array<{ sourceNodeId: string; targetNodeId: string; dependencyType: string }>; nodeIds: string[] }) {
  const predecessors = new Map<string, string[]>();
  for (const nodeId of [...input.nodeIds].sort(compareByLexical)) {
    predecessors.set(nodeId, []);
  }

  for (const edge of [...input.edges].sort((left, right) => {
    const bySource = left.sourceNodeId.localeCompare(right.sourceNodeId);
    if (bySource !== 0) {
      return bySource;
    }
    const byTarget = left.targetNodeId.localeCompare(right.targetNodeId);
    if (byTarget !== 0) {
      return byTarget;
    }
    return left.dependencyType.localeCompare(right.dependencyType);
  })) {
    if (edge.dependencyType !== 'finish_to_start') {
      continue;
    }

    const current = predecessors.get(edge.targetNodeId) ?? [];
    current.push(edge.sourceNodeId);
    current.sort(compareByLexical);
    predecessors.set(edge.targetNodeId, current);
  }

  return predecessors;
}

function deriveDepthByNode(input: {
  edges: Array<{ sourceNodeId: string; targetNodeId: string; dependencyType: string }>;
  nodeIds: string[];
}): Record<string, number> {
  const predecessors = buildPredecessors(input);
  const cache = new Map<string, number>();

  function visit(nodeId: string, seen: Set<string>): number {
    if (cache.has(nodeId)) {
      return cache.get(nodeId) ?? 0;
    }

    if (seen.has(nodeId)) {
      return Number.MAX_SAFE_INTEGER;
    }

    seen.add(nodeId);
    const parents = predecessors.get(nodeId) ?? [];
    if (parents.length === 0) {
      cache.set(nodeId, 0);
      seen.delete(nodeId);
      return 0;
    }

    const depth = Math.max(...parents.map((parent) => visit(parent, seen))) + 1;
    cache.set(nodeId, depth);
    seen.delete(nodeId);
    return depth;
  }

  for (const nodeId of [...input.nodeIds].sort(compareByLexical)) {
    visit(nodeId, new Set<string>());
  }

  return Object.fromEntries([...cache.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function retryRank(input: { retryAttemptByNode: Record<string, number>; taskNodeId: string; policy: WorkerSchedulingPolicy }): number {
  const attemptIndex = input.retryAttemptByNode[input.taskNodeId] ?? 0;
  const isRetry = attemptIndex > 0;

  if (input.policy.retryPriorityMode === 'stable_mixed') {
    return 0;
  }

  if (input.policy.retryPriorityMode === 'before_fresh_ready') {
    return isRetry ? 0 : 1;
  }

  return isRetry ? 1 : 0;
}

function canWorkerRunTask(worker: WorkerDefinition, taskNode: MissionTaskNode): boolean {
  if (!worker.supportedTaskTypes.includes(taskNode.taskType)) {
    return false;
  }

  const requiredCapabilities = uniqueSorted(taskNode.requiredCapabilities);
  return requiredCapabilities.every((capability) => worker.capabilities.includes(capability));
}

function deferralFromWorkerStatus(worker: WorkerDefinition): AssignmentDeferralReason {
  if (worker.status === 'paused') {
    return 'worker_paused';
  }

  if (worker.status === 'disabled') {
    return 'worker_disabled';
  }

  return 'worker_unavailable';
}

function compareWorkerCandidate(input: {
  workerLoadById: Record<string, number>;
  workerById: Record<string, WorkerDefinition>;
  policy: WorkerSchedulingPolicy;
}) {
  return (leftWorkerId: string, rightWorkerId: string): number => {
    const leftWorker = input.workerById[leftWorkerId];
    const rightWorker = input.workerById[rightWorkerId];

    if (!leftWorker || !rightWorker) {
      return leftWorkerId.localeCompare(rightWorkerId);
    }

    if (input.policy.workerSelectionStrategy === 'balanced_capacity') {
      const leftRemaining = Math.max(leftWorker.maxConcurrentAssignments - (input.workerLoadById[leftWorkerId] ?? 0), 0);
      const rightRemaining = Math.max(rightWorker.maxConcurrentAssignments - (input.workerLoadById[rightWorkerId] ?? 0), 0);
      const byRemaining = rightRemaining - leftRemaining;
      if (byRemaining !== 0) {
        return byRemaining;
      }
    }

    const leftLoad = input.workerLoadById[leftWorkerId] ?? 0;
    const rightLoad = input.workerLoadById[rightWorkerId] ?? 0;
    const byLoad = leftLoad - rightLoad;
    if (byLoad !== 0) {
      return byLoad;
    }

    return leftWorkerId.localeCompare(rightWorkerId);
  };
}

function compareRunnableNode(input: {
  schedulerIndexByNode: Record<string, number>;
  retryAttemptByNode: Record<string, number>;
  depthByNode: Record<string, number>;
  policy: WorkerSchedulingPolicy;
}) {
  return (leftNodeId: string, rightNodeId: string): number => {
    const leftSchedulerIndex = input.schedulerIndexByNode[leftNodeId] ?? Number.MAX_SAFE_INTEGER;
    const rightSchedulerIndex = input.schedulerIndexByNode[rightNodeId] ?? Number.MAX_SAFE_INTEGER;
    const byScheduler = leftSchedulerIndex - rightSchedulerIndex;
    if (byScheduler !== 0) {
      return byScheduler;
    }

    const byRetry = retryRank({ retryAttemptByNode: input.retryAttemptByNode, taskNodeId: leftNodeId, policy: input.policy })
      - retryRank({ retryAttemptByNode: input.retryAttemptByNode, taskNodeId: rightNodeId, policy: input.policy });
    if (byRetry !== 0) {
      return byRetry;
    }

    const byDepth = (input.depthByNode[leftNodeId] ?? Number.MAX_SAFE_INTEGER) - (input.depthByNode[rightNodeId] ?? Number.MAX_SAFE_INTEGER);
    if (byDepth !== 0) {
      return byDepth;
    }

    return leftNodeId.localeCompare(rightNodeId);
  };
}

export function scheduleWorkerAssignments(input: {
  executionRunId: string;
  taskGraphId: string;
  cycleIndex: number;
  policy: WorkerSchedulingPolicy;
  runnableNodeIds: string[];
  taskNodes: MissionTaskNode[];
  taskEdges: Array<{ sourceNodeId: string; targetNodeId: string; dependencyType: string }>;
  workers: WorkerDefinition[];
  retryAttemptByNode: Record<string, number>;
  currentAssignedByWorker: Record<string, number>;
}): WorkerAssignmentDecision[] {
  const taskNodeById = Object.fromEntries(
    [...input.taskNodes]
      .sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))
      .map((taskNode) => [taskNode.taskNodeId, taskNode]),
  ) as Record<string, MissionTaskNode>;

  const workerById = Object.fromEntries(
    [...input.workers]
      .sort((left, right) => left.workerId.localeCompare(right.workerId))
      .map((worker) => [worker.workerId, worker]),
  ) as Record<string, WorkerDefinition>;

  const depthByNode = deriveDepthByNode({
    edges: input.taskEdges,
    nodeIds: Object.keys(taskNodeById),
  });

  const schedulerIndexByNode = Object.fromEntries(
    [...input.runnableNodeIds]
      .sort((left, right) => left.localeCompare(right))
      .map((taskNodeId, index) => [taskNodeId, index]),
  ) as Record<string, number>;

  const orderedNodeIds = [...input.runnableNodeIds]
    .sort(compareRunnableNode({
      schedulerIndexByNode,
      retryAttemptByNode: input.retryAttemptByNode,
      depthByNode,
      policy: input.policy,
    }));

  const workerLoadById: Record<string, number> = Object.fromEntries(
    [...Object.entries(input.currentAssignedByWorker)].sort(([left], [right]) => left.localeCompare(right)),
  );

  const decisions: WorkerAssignmentDecision[] = [];

  for (const [taskIndex, taskNodeId] of orderedNodeIds.entries()) {
    const taskNode = taskNodeById[taskNodeId];
    if (!taskNode) {
      continue;
    }

    if (decisions.filter((decision) => decision.assignmentState === 'assigned').length >= input.policy.maxAssignmentsPerCycle) {
      const decisionId = deriveAssignmentDecisionId({
        executionRunId: input.executionRunId,
        taskNodeId,
        cycleIndex: input.cycleIndex,
        workerId: null,
        policyId: input.policy.policyId,
        assignmentState: 'deferred',
        selectionReasonTokens: ['max_assignments_per_cycle'],
        deferralReasonTokens: ['deterministic_ordering_deferred'],
      });

      decisions.push(normalizeAssignmentDecision({
        assignmentDecisionId: decisionId,
        executionRunId: input.executionRunId,
        taskNodeId,
        workerId: null,
        cycleIndex: input.cycleIndex,
        assignmentState: 'deferred',
        selectionReasonTokens: ['max_assignments_per_cycle'],
        deferralReasonTokens: ['deterministic_ordering_deferred'],
        workerCompatibilitySummary: {
          compatibleWorkerIds: [],
          incompatibleWorkerIds: Object.keys(workerById).sort(compareByLexical),
        },
        workerCapacitySummary: {
          workerId: null,
          maxConcurrentAssignments: 0,
          currentAssignedCount: 0,
          remainingCapacity: 0,
        },
        alternativesConsidered: [],
        policyId: input.policy.policyId,
      }));
      continue;
    }

    const compatibilityPairs = Object.keys(workerById)
      .sort(compareByLexical)
      .map((workerId) => ({
        workerId,
        worker: workerById[workerId],
        compatible: canWorkerRunTask(workerById[workerId], taskNode),
      }));

    const compatibleWorkerIds = compatibilityPairs
      .filter((pair) => pair.compatible)
      .map((pair) => pair.workerId)
      .sort(compareWorkerCandidate({
        workerLoadById,
        workerById,
        policy: input.policy,
      }));

    const incompatibleWorkerIds = compatibilityPairs
      .filter((pair) => !pair.compatible)
      .map((pair) => pair.workerId)
      .sort(compareByLexical);

    if (compatibleWorkerIds.length === 0) {
      const decisionId = deriveAssignmentDecisionId({
        executionRunId: input.executionRunId,
        taskNodeId,
        cycleIndex: input.cycleIndex,
        workerId: null,
        policyId: input.policy.policyId,
        assignmentState: 'incompatible',
        selectionReasonTokens: [`deterministic_rank:${String(taskIndex)}`],
        deferralReasonTokens: ['no_compatible_worker'],
      });

      decisions.push(normalizeAssignmentDecision({
        assignmentDecisionId: decisionId,
        executionRunId: input.executionRunId,
        taskNodeId,
        workerId: null,
        cycleIndex: input.cycleIndex,
        assignmentState: 'incompatible',
        selectionReasonTokens: [`deterministic_rank:${String(taskIndex)}`],
        deferralReasonTokens: ['no_compatible_worker'],
        workerCompatibilitySummary: {
          compatibleWorkerIds: [],
          incompatibleWorkerIds,
        },
        workerCapacitySummary: {
          workerId: null,
          maxConcurrentAssignments: 0,
          currentAssignedCount: 0,
          remainingCapacity: 0,
        },
        alternativesConsidered: [],
        policyId: input.policy.policyId,
      }));
      continue;
    }

    const activeCompatible = compatibleWorkerIds.filter((workerId) => workerById[workerId].status === 'active');
    const pausedCompatible = compatibleWorkerIds.filter((workerId) => workerById[workerId].status === 'paused');
    const disabledCompatible = compatibleWorkerIds.filter((workerId) => workerById[workerId].status === 'disabled');

    if (activeCompatible.length === 0) {
      const reason: AssignmentDeferralReason = pausedCompatible.length > 0
        ? 'worker_paused'
        : disabledCompatible.length > 0
          ? 'worker_disabled'
          : 'worker_unavailable';

      const decisionId = deriveAssignmentDecisionId({
        executionRunId: input.executionRunId,
        taskNodeId,
        cycleIndex: input.cycleIndex,
        workerId: null,
        policyId: input.policy.policyId,
        assignmentState: 'worker_unavailable',
        selectionReasonTokens: [`deterministic_rank:${String(taskIndex)}`],
        deferralReasonTokens: [reason],
      });

      decisions.push(normalizeAssignmentDecision({
        assignmentDecisionId: decisionId,
        executionRunId: input.executionRunId,
        taskNodeId,
        workerId: null,
        cycleIndex: input.cycleIndex,
        assignmentState: 'worker_unavailable',
        selectionReasonTokens: [`deterministic_rank:${String(taskIndex)}`],
        deferralReasonTokens: [reason],
        workerCompatibilitySummary: {
          compatibleWorkerIds,
          incompatibleWorkerIds,
        },
        workerCapacitySummary: {
          workerId: null,
          maxConcurrentAssignments: 0,
          currentAssignedCount: 0,
          remainingCapacity: 0,
        },
        alternativesConsidered: [...pausedCompatible, ...disabledCompatible].sort(compareByLexical),
        policyId: input.policy.policyId,
      }));
      continue;
    }

    const capacityReadyWorkers = activeCompatible.filter((workerId) => {
      const worker = workerById[workerId];
      const current = workerLoadById[workerId] ?? 0;
      return current < worker.maxConcurrentAssignments;
    });

    if (capacityReadyWorkers.length === 0) {
      const alternatives = activeCompatible.map((workerId) => {
        const worker = workerById[workerId];
        return `${workerId}:${String(workerLoadById[workerId] ?? 0)}/${String(worker.maxConcurrentAssignments)}`;
      });

      const first = activeCompatible[0]!;
      const decisionId = deriveAssignmentDecisionId({
        executionRunId: input.executionRunId,
        taskNodeId,
        cycleIndex: input.cycleIndex,
        workerId: null,
        policyId: input.policy.policyId,
        assignmentState: 'capacity_exhausted',
        selectionReasonTokens: [`deterministic_rank:${String(taskIndex)}`],
        deferralReasonTokens: ['no_capacity'],
      });

      decisions.push(normalizeAssignmentDecision({
        assignmentDecisionId: decisionId,
        executionRunId: input.executionRunId,
        taskNodeId,
        workerId: null,
        cycleIndex: input.cycleIndex,
        assignmentState: 'capacity_exhausted',
        selectionReasonTokens: [`deterministic_rank:${String(taskIndex)}`],
        deferralReasonTokens: ['no_capacity'],
        workerCompatibilitySummary: {
          compatibleWorkerIds,
          incompatibleWorkerIds,
        },
        workerCapacitySummary: {
          workerId: first,
          maxConcurrentAssignments: workerById[first].maxConcurrentAssignments,
          currentAssignedCount: workerLoadById[first] ?? 0,
          remainingCapacity: Math.max(workerById[first].maxConcurrentAssignments - (workerLoadById[first] ?? 0), 0),
        },
        alternativesConsidered: alternatives.sort(compareByLexical),
        policyId: input.policy.policyId,
      }));
      continue;
    }

    const workerId = capacityReadyWorkers[0]!;
    const worker = workerById[workerId];
    const currentAssignedCount = workerLoadById[workerId] ?? 0;

    const decisionId = deriveAssignmentDecisionId({
      executionRunId: input.executionRunId,
      taskNodeId,
      cycleIndex: input.cycleIndex,
      workerId,
      policyId: input.policy.policyId,
      assignmentState: 'assigned',
      selectionReasonTokens: [
        `deterministic_rank:${String(taskIndex)}`,
        `worker_strategy:${input.policy.workerSelectionStrategy}`,
      ],
      deferralReasonTokens: [],
    });

    decisions.push(normalizeAssignmentDecision({
      assignmentDecisionId: decisionId,
      executionRunId: input.executionRunId,
      taskNodeId,
      workerId,
      cycleIndex: input.cycleIndex,
      assignmentState: 'assigned',
      selectionReasonTokens: [
        `deterministic_rank:${String(taskIndex)}`,
        `worker_strategy:${input.policy.workerSelectionStrategy}`,
      ],
      deferralReasonTokens: [],
      workerCompatibilitySummary: {
        compatibleWorkerIds,
        incompatibleWorkerIds,
      },
      workerCapacitySummary: {
        workerId,
        maxConcurrentAssignments: worker.maxConcurrentAssignments,
        currentAssignedCount,
        remainingCapacity: Math.max(worker.maxConcurrentAssignments - currentAssignedCount - 1, 0),
      },
      alternativesConsidered: capacityReadyWorkers.slice(1),
      policyId: input.policy.policyId,
    }));

    workerLoadById[workerId] = currentAssignedCount + 1;
  }

  return [...decisions].sort((left, right) => {
    const byNode = left.taskNodeId.localeCompare(right.taskNodeId);
    if (byNode !== 0) {
      return byNode;
    }

    const byWorker = (left.workerId ?? '').localeCompare(right.workerId ?? '');
    if (byWorker !== 0) {
      return byWorker;
    }

    return left.assignmentDecisionId.localeCompare(right.assignmentDecisionId);
  });
}

export function workerStatusReason(worker: WorkerDefinition): AssignmentDeferralReason | null {
  if (worker.status === 'active') {
    return null;
  }

  return deferralFromWorkerStatus(worker);
}
