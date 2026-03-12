import { canonicalStringify } from '../finance/determinism.ts';
import {
  createTaskGraphProjection,
  type TaskGraphProjectionEngine,
} from '../task-graph/task-graph-projection.ts';
import type { MissionTaskGraphProjection, TaskNodeState } from '../task-graph/task-graph-types.ts';

import {
  createTaskExecutionHistoryStore,
  resolveTaskExecutionArtifactPaths,
  type TaskExecutionHistoryStore,
} from './task-execution-history-store.ts';
import { detectReadyTaskNodeIds } from './task-ready-node-detector.ts';
import { applyTaskNodeTransition } from './task-node-transition.ts';
import type {
  MissionTaskExecutionProjection,
  MissionTaskExecutionStep,
  TaskExecutionGraphState,
  TaskExecutionNodeState,
  TaskExecutionStepType,
} from './task-execution-step-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(value)) as Record<string, unknown>;
}

function compareSteps(left: MissionTaskExecutionStep, right: MissionTaskExecutionStep): number {
  const byIndex = left.stepIndex - right.stepIndex;
  if (byIndex !== 0) {
    return byIndex;
  }

  const byType = left.stepType.localeCompare(right.stepType);
  if (byType !== 0) {
    return byType;
  }

  return left.executionStepId.localeCompare(right.executionStepId);
}

function mapTaskNodeState(state: TaskNodeState): TaskExecutionNodeState {
  switch (state) {
    case 'ready':
      return 'ready';
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'blocked':
      return 'blocked';
    case 'skipped':
      return 'skipped';
    case 'pending':
    default:
      return 'pending';
  }
}

function buildPredecessors(taskGraph: MissionTaskGraphProjection): Map<string, string[]> {
  const predecessors = new Map<string, string[]>();

  for (const node of [...taskGraph.taskNodes].sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))) {
    predecessors.set(node.taskNodeId, []);
  }

  for (const edge of [...taskGraph.taskEdges].sort((left, right) => {
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
    current.sort((left, right) => left.localeCompare(right));
    predecessors.set(edge.targetNodeId, current);
  }

  return predecessors;
}

function isStepRecord(value: unknown): value is MissionTaskExecutionStep {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.executionStepId === 'string'
    && typeof row.executionEngineRunId === 'string'
    && typeof row.executionAttemptId === 'string'
    && typeof row.taskGraphId === 'string'
    && (typeof row.taskNodeId === 'string' || row.taskNodeId === null)
    && typeof row.stepIndex === 'number'
    && Number.isInteger(row.stepIndex)
    && typeof row.stepType === 'string'
    && typeof row.stepState === 'string'
    && typeof row.eventDedupeKey === 'string'
    && typeof row.stepInputs === 'object'
    && row.stepInputs !== null
    && !Array.isArray(row.stepInputs)
    && typeof row.stepOutputs === 'object'
    && row.stepOutputs !== null
    && !Array.isArray(row.stepOutputs)
  );
}

type ReplayResult = {
  nodeStates: Record<string, TaskExecutionNodeState>;
  steps: MissionTaskExecutionStep[];
  blockingReasonsByNode: Record<string, string[]>;
  failureClassByNode: Record<string, string>;
  retryAttempts: MissionTaskExecutionProjection['retryAttempts'];
  retryLimitBreaches: MissionTaskExecutionProjection['retryLimitBreaches'];
};

function parseRetryAttempt(value: unknown): MissionTaskExecutionProjection['retryAttempts'][number] | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  if (
    typeof row.taskNodeId !== 'string'
    || typeof row.attemptIndex !== 'number'
    || typeof row.failureClass !== 'string'
    || typeof row.retryPolicyId !== 'string'
    || typeof row.retryState !== 'string'
    || typeof row.retryCount !== 'number'
    || !Number.isInteger(row.attemptIndex)
    || !Number.isInteger(row.retryCount)
  ) {
    return null;
  }

  return {
    taskNodeId: row.taskNodeId,
    attemptIndex: row.attemptIndex,
    failureClass: row.failureClass,
    retryPolicyId: row.retryPolicyId,
    retryState: row.retryState,
    retryCount: row.retryCount,
  };
}

function replayExecutionHistory(input: {
  taskGraph: MissionTaskGraphProjection;
  historyEntries: Array<{
    eventType: TaskExecutionStepType;
    eventPayload: Record<string, unknown>;
  }>;
}): ReplayResult {
  const nodeStates: Record<string, TaskExecutionNodeState> = Object.fromEntries(
    [...input.taskGraph.taskNodes]
      .sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))
      .map((node) => [node.taskNodeId, mapTaskNodeState(node.taskState)]),
  );

  const blockingReasonsByNode = new Map<string, Set<string>>(
    [...input.taskGraph.taskNodes]
      .sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))
      .map((node) => [node.taskNodeId, new Set(node.blockingReasons)]),
  );

  const failureClassByNode = new Map<string, string>();
  const retryAttempts: MissionTaskExecutionProjection['retryAttempts'] = [];
  const retryLimitBreaches: MissionTaskExecutionProjection['retryLimitBreaches'] = [];
  const steps: MissionTaskExecutionStep[] = [];

  for (const entry of input.historyEntries) {
    const stepPayload = entry.eventPayload.step;
    if (isStepRecord(stepPayload)) {
      steps.push({
        ...stepPayload,
        stepInputs: normalizeRecord(stepPayload.stepInputs),
        stepOutputs: normalizeRecord(stepPayload.stepOutputs),
      });
    }

    const taskNodeId = typeof entry.eventPayload.taskNodeId === 'string'
      ? entry.eventPayload.taskNodeId
      : null;

    if (!taskNodeId) {
      continue;
    }

    if (!(taskNodeId in nodeStates)) {
      throw new Error('TASK_EXECUTION_HISTORY_CONFLICT');
    }

    const currentState = nodeStates[taskNodeId] ?? 'pending';

    if (entry.eventType === 'node_execution_started') {
      if (currentState === 'pending' || currentState === 'retrying') {
        nodeStates[taskNodeId] = applyTaskNodeTransition({
          currentState,
          nextState: 'ready',
        });
      }

      nodeStates[taskNodeId] = applyTaskNodeTransition({
        currentState: nodeStates[taskNodeId] ?? 'ready',
        nextState: 'running',
      });
      continue;
    }

    if (entry.eventType === 'node_execution_completed') {
      nodeStates[taskNodeId] = applyTaskNodeTransition({
        currentState,
        nextState: 'completed',
      });
      continue;
    }

    if (entry.eventType === 'node_execution_failed') {
      nodeStates[taskNodeId] = applyTaskNodeTransition({
        currentState,
        nextState: 'failed',
      });

      const failureClass = typeof entry.eventPayload.failureClass === 'string'
        ? entry.eventPayload.failureClass
        : 'NON_RETRYABLE_FAILURE';
      failureClassByNode.set(taskNodeId, failureClass);

      const reasons = blockingReasonsByNode.get(taskNodeId) ?? new Set<string>();
      reasons.add(`task_failed:${taskNodeId}`);
      reasons.add(`failure_class:${failureClass.toLowerCase()}`);
      blockingReasonsByNode.set(taskNodeId, reasons);
      continue;
    }

    if (entry.eventType === 'node_retry_scheduled') {
      nodeStates[taskNodeId] = applyTaskNodeTransition({
        currentState,
        nextState: 'retrying',
      });

      const attempt = parseRetryAttempt(entry.eventPayload.retryAttempt);
      if (attempt) {
        retryAttempts.push(attempt);
      }
      continue;
    }

    if (entry.eventType === 'node_retry_started') {
      nodeStates[taskNodeId] = applyTaskNodeTransition({
        currentState,
        nextState: 'ready',
      });

      const attempt = parseRetryAttempt(entry.eventPayload.retryAttempt);
      if (attempt) {
        retryAttempts.push(attempt);
      }
      continue;
    }

    if (entry.eventType === 'node_retry_exhausted') {
      nodeStates[taskNodeId] = applyTaskNodeTransition({
        currentState,
        nextState: 'permanently_failed',
      });

      const reason = typeof entry.eventPayload.reason === 'string'
        ? entry.eventPayload.reason
        : 'retry_exhausted';

      retryLimitBreaches.push({
        taskNodeId,
        retryPolicyId: typeof entry.eventPayload.retryPolicyId === 'string'
          ? entry.eventPayload.retryPolicyId
          : 'mission_task_retry_default_v1',
        attemptIndex: typeof entry.eventPayload.attemptIndex === 'number'
          ? entry.eventPayload.attemptIndex
          : 0,
        reason,
      });

      const reasons = blockingReasonsByNode.get(taskNodeId) ?? new Set<string>();
      reasons.add(`retry_exhausted:${taskNodeId}`);
      blockingReasonsByNode.set(taskNodeId, reasons);
      continue;
    }

    if (entry.eventType === 'node_blocked') {
      nodeStates[taskNodeId] = applyTaskNodeTransition({
        currentState,
        nextState: 'blocked',
      });

      const reasons = blockingReasonsByNode.get(taskNodeId) ?? new Set<string>();
      const blockingReason = typeof entry.eventPayload.blockingReason === 'string'
        ? entry.eventPayload.blockingReason
        : 'DEPENDENCY_FAILED';
      reasons.add(blockingReason);
      blockingReasonsByNode.set(taskNodeId, reasons);
    }
  }

  return {
    nodeStates,
    steps: [...steps].sort(compareSteps),
    blockingReasonsByNode: Object.fromEntries(
      [...blockingReasonsByNode.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([taskNodeId, reasons]) => [taskNodeId, uniqueSorted([...reasons])]),
    ),
    failureClassByNode: Object.fromEntries(
      [...failureClassByNode.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
    retryAttempts: [...retryAttempts].sort((left, right) => {
      const byNode = left.taskNodeId.localeCompare(right.taskNodeId);
      if (byNode !== 0) {
        return byNode;
      }
      const byAttempt = left.attemptIndex - right.attemptIndex;
      if (byAttempt !== 0) {
        return byAttempt;
      }
      return left.retryState.localeCompare(right.retryState);
    }),
    retryLimitBreaches: [...retryLimitBreaches].sort((left, right) => {
      const byNode = left.taskNodeId.localeCompare(right.taskNodeId);
      if (byNode !== 0) {
        return byNode;
      }
      return left.attemptIndex - right.attemptIndex;
    }),
  };
}

function resolveSeedByExecutionEngineRunId(input: {
  executionEngineRunId: string;
  historyStore: TaskExecutionHistoryStore;
}): { taskGraphId: string } | null {
  const history = input.historyStore.loadByExecutionEngineRunId({
    executionEngineRunId: input.executionEngineRunId,
  });

  if (!history || !history.taskGraphId) {
    return null;
  }

  return {
    taskGraphId: history.taskGraphId,
  };
}

function deriveGraphState(input: {
  totalNodeCount: number;
  readyNodeCount: number;
  runningNodeCount: number;
  retryingNodeCount: number;
  completedNodeCount: number;
  blockedNodeCount: number;
  failedNodeCount: number;
  graphFailureState: MissionTaskExecutionProjection['graphFailureState'];
}): TaskExecutionGraphState {
  if (input.totalNodeCount > 0 && input.completedNodeCount === input.totalNodeCount) {
    return 'completed';
  }

  if (input.graphFailureState !== 'none' || input.failedNodeCount > 0) {
    return 'failed';
  }

  if (input.blockedNodeCount > 0 && input.readyNodeCount === 0 && input.runningNodeCount === 0 && input.retryingNodeCount === 0) {
    return 'blocked';
  }

  return 'running';
}

export function createTaskExecutionProjection(options: {
  taskGraphProjection?: TaskGraphProjectionEngine;
  historyStore?: TaskExecutionHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
  executionAttemptArtifactsRoot?: string;
  executionJournalArtifactsRoot?: string;
  executionEngineArtifactsRoot?: string;
  taskGraphArtifactsRoot?: string;
  taskExecutionArtifactsRoot?: string;
} = {}) {
  const taskGraphProjection = options.taskGraphProjection ?? createTaskGraphProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createTaskExecutionHistoryStore({
    artifactsRoot: options.taskExecutionArtifactsRoot,
  });

  function projectOne(input: {
    taskGraphId?: string;
    executionEngineRunId?: string;
  }): MissionTaskExecutionProjection {
    let taskGraphId = input.taskGraphId;

    if (!taskGraphId && input.executionEngineRunId) {
      const seed = resolveSeedByExecutionEngineRunId({
        executionEngineRunId: input.executionEngineRunId,
        historyStore,
      });
      if (seed) {
        taskGraphId = seed.taskGraphId;
      }
    }

    if (!taskGraphId && !input.executionEngineRunId) {
      throw new Error('TASK_EXECUTION_RUN_NOT_FOUND');
    }

    const taskGraph = taskGraphProjection.projectOne({
      ...(taskGraphId ? { taskGraphId } : {}),
      ...(input.executionEngineRunId ? { executionEngineRunId: input.executionEngineRunId } : {}),
    });

    if (taskGraphId && taskGraphId !== taskGraph.taskGraphId) {
      throw new Error('TASK_GRAPH_NOT_FOUND');
    }

    if (input.executionEngineRunId && input.executionEngineRunId !== taskGraph.executionEngineRunId) {
      throw new Error('TASK_EXECUTION_RUN_NOT_FOUND');
    }

    const history = historyStore.load({
      executionEngineRunId: taskGraph.executionEngineRunId,
      executionAttemptId: taskGraph.executionAttemptId,
      taskGraphId: taskGraph.taskGraphId,
    });

    const replayed = replayExecutionHistory({
      taskGraph,
      historyEntries: history.entries,
    });

    const projectedNodeStates: Record<string, TaskExecutionNodeState> = {
      ...replayed.nodeStates,
    };

    const predecessors = buildPredecessors(taskGraph);
    const terminalBlockingStates: TaskExecutionNodeState[] = ['permanently_failed', 'blocked'];

    for (const node of [...taskGraph.taskNodes].sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))) {
      if (projectedNodeStates[node.taskNodeId] !== 'pending') {
        continue;
      }

      const dependencyIds = predecessors.get(node.taskNodeId) ?? [];
      const dependencyBlockers = dependencyIds
        .filter((dependencyNodeId) => terminalBlockingStates.includes(projectedNodeStates[dependencyNodeId] ?? 'pending'))
        .sort((left, right) => left.localeCompare(right));

      if (dependencyBlockers.length === 0) {
        continue;
      }

      projectedNodeStates[node.taskNodeId] = applyTaskNodeTransition({
        currentState: 'pending',
        nextState: 'blocked',
      });

      const reasons = replayed.blockingReasonsByNode[node.taskNodeId] ?? [];
      replayed.blockingReasonsByNode[node.taskNodeId] = uniqueSorted([
        ...reasons,
        'DEPENDENCY_FAILED',
        ...dependencyBlockers.map((dependencyNodeId) => `dependency_terminal_failure:${dependencyNodeId}`),
      ]);
    }

    const readyFromPending = detectReadyTaskNodeIds({
      taskGraph,
      nodeStates: projectedNodeStates,
    });

    for (const taskNodeId of readyFromPending) {
      projectedNodeStates[taskNodeId] = 'ready';
    }

    const nodeStateValues = Object.values(projectedNodeStates);
    const readyNodeCount = nodeStateValues.filter((state) => state === 'ready').length;
    const runningNodeCount = nodeStateValues.filter((state) => state === 'running').length;
    const retryingNodeCount = nodeStateValues.filter((state) => state === 'retrying').length;
    const completedNodeCount = nodeStateValues.filter((state) => state === 'completed').length;
    const failedNodeCount = nodeStateValues.filter((state) => state === 'failed' || state === 'permanently_failed').length;
    const blockedNodeCount = nodeStateValues.filter((state) => state === 'blocked').length;

    const graphFailureState: MissionTaskExecutionProjection['graphFailureState'] = replayed.retryLimitBreaches.length > 0
      ? 'retry_exhausted'
      : nodeStateValues.some((state) => state === 'permanently_failed')
        ? 'unrecoverable_failure'
        : 'none';

    const graphState = deriveGraphState({
      totalNodeCount: taskGraph.nodeCount,
      readyNodeCount,
      runningNodeCount,
      retryingNodeCount,
      completedNodeCount,
      blockedNodeCount,
      failedNodeCount,
      graphFailureState,
    });

    const blockingNodes = Object.entries(projectedNodeStates)
      .filter(([, nodeState]) => nodeState === 'blocked' || nodeState === 'permanently_failed')
      .map(([taskNodeId]) => taskNodeId)
      .sort((left, right) => left.localeCompare(right));

    const blockingReasons = uniqueSorted([
      ...taskGraph.blockingReasons,
      ...blockingNodes.flatMap((taskNodeId) => replayed.blockingReasonsByNode[taskNodeId] ?? []),
      ...(graphState === 'blocked' ? ['TASK_GRAPH_BLOCKED'] : []),
      ...(graphState === 'failed' ? ['TASK_GRAPH_FAILED'] : []),
    ]);

    const steps = [...replayed.steps].sort(compareSteps);
    const lastExecutionStepId = steps.length > 0
      ? steps[steps.length - 1]!.executionStepId
      : null;

    const executionProgress = {
      completed: completedNodeCount,
      total: taskGraph.nodeCount,
      ratio: taskGraph.nodeCount === 0 ? 0 : completedNodeCount / taskGraph.nodeCount,
    };

    const engineState = graphState === 'completed'
      ? 'completed'
      : graphState === 'failed'
        ? 'failed'
        : graphState === 'blocked'
          ? 'blocked'
          : 'active';

    const artifactPaths = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: taskGraph.executionEngineRunId,
      rootDir: options.taskExecutionArtifactsRoot,
    });

    const statusPreview = {
      executionEngineRunId: taskGraph.executionEngineRunId,
      executionAttemptId: taskGraph.executionAttemptId,
      taskGraphId: taskGraph.taskGraphId,
      executionStepCount: steps.length,
      failedNodeCount,
      retryingNodeCount,
      readyNodeCount,
      runningNodeCount,
      completedNodeCount,
      blockedNodeCount,
      graphState,
      graphFailureState,
      executionProgress,
      blockingNodes,
      blockingReasons,
      retryAttempts: replayed.retryAttempts,
      retryLimitBreaches: replayed.retryLimitBreaches,
      lastExecutionStepId,
    } as Record<string, unknown>;

    const reportPreview = {
      executionEngineRunId: taskGraph.executionEngineRunId,
      executionAttemptId: taskGraph.executionAttemptId,
      taskGraphId: taskGraph.taskGraphId,
      graphState,
      graphFailureState,
      engineState,
      nodeStates: Object.fromEntries(Object.entries(projectedNodeStates).sort(([left], [right]) => left.localeCompare(right))),
      failureClassByNode: replayed.failureClassByNode,
      retryAttempts: replayed.retryAttempts,
      retryLimitBreaches: replayed.retryLimitBreaches,
      blockingNodes,
      blockingReasonsByNode: replayed.blockingReasonsByNode,
      steps,
      history,
      executionProgress,
      blockingReasons,
      provenanceInputs: {
        taskGraphState: taskGraph.graphState,
        taskGraphNodeCount: taskGraph.nodeCount,
        taskGraphEdgeCount: taskGraph.edgeCount,
        taskGraphBlockingReasons: taskGraph.blockingReasons,
      },
    } as Record<string, unknown>;

    return {
      executionEngineRunId: taskGraph.executionEngineRunId,
      executionAttemptId: taskGraph.executionAttemptId,
      taskGraphId: taskGraph.taskGraphId,
      executionStepCount: steps.length,
      failedNodeCount,
      retryingNodeCount,
      readyNodeCount,
      runningNodeCount,
      completedNodeCount,
      blockedNodeCount,
      graphState,
      executionProgress,
      blockingReasons,
      blockingNodes,
      lastExecutionStepId,
      engineState,
      steps,
      nodeStates: Object.fromEntries(Object.entries(projectedNodeStates).sort(([left], [right]) => left.localeCompare(right))),
      retryAttempts: replayed.retryAttempts,
      retryLimitBreaches: replayed.retryLimitBreaches,
      graphFailureState,
      statusPreview,
      reportPreview,
      artifactPaths,
      provenanceInputs: {
        taskGraphState: taskGraph.graphState,
        taskGraphNodeCount: taskGraph.nodeCount,
        taskGraphEdgeCount: taskGraph.edgeCount,
        taskGraphBlockingReasons: [...taskGraph.blockingReasons].sort((left, right) => left.localeCompare(right)),
      },
    };
  }

  function projectAll(): MissionTaskExecutionProjection[] {
    return taskGraphProjection.projectAll()
      .map((taskGraph) => projectOne({ taskGraphId: taskGraph.taskGraphId }))
      .sort((left, right) => left.taskGraphId.localeCompare(right.taskGraphId));
  }

  function summarizeList() {
    return projectAll().map((entry) => ({
      executionEngineRunId: entry.executionEngineRunId,
      executionAttemptId: entry.executionAttemptId,
      taskGraphId: entry.taskGraphId,
      graphState: entry.graphState,
      executionStepCount: entry.executionStepCount,
      completedNodeCount: entry.completedNodeCount,
      readyNodeCount: entry.readyNodeCount,
    })).sort((left, right) => left.taskGraphId.localeCompare(right.taskGraphId));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type TaskExecutionProjectionEngine = ReturnType<typeof createTaskExecutionProjection>;
