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

function deriveGraphState(input: {
  totalNodeCount: number;
  readyNodeCount: number;
  runningNodeCount: number;
  completedNodeCount: number;
  blockedNodeCount: number;
}): TaskExecutionGraphState {
  if (input.totalNodeCount > 0 && input.completedNodeCount === input.totalNodeCount) {
    return 'completed';
  }

  if (input.runningNodeCount > 0 || input.completedNodeCount > 0) {
    return 'in_progress';
  }

  if (input.readyNodeCount > 0) {
    return 'pending';
  }

  if (input.blockedNodeCount > 0 || input.totalNodeCount > 0) {
    return 'blocked';
  }

  return 'pending';
}

function asStepType(value: unknown): TaskExecutionStepType | null {
  if (
    value === 'node_execution_started'
    || value === 'node_execution_completed'
    || value === 'node_execution_failed'
    || value === 'graph_execution_progressed'
    || value === 'graph_execution_completed'
  ) {
    return value;
  }
  return null;
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

function replayExecutionHistory(input: {
  taskGraph: MissionTaskGraphProjection;
  historyEntries: Array<{
    eventType: TaskExecutionStepType;
    eventPayload: Record<string, unknown>;
  }>;
}): {
  nodeStates: Record<string, TaskExecutionNodeState>;
  steps: MissionTaskExecutionStep[];
  blockingReasons: string[];
} {
  const nodeStates: Record<string, TaskExecutionNodeState> = Object.fromEntries(
    [...input.taskGraph.taskNodes]
      .sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))
      .map((node) => [node.taskNodeId, mapTaskNodeState(node.taskState)]),
  );

  const blockingReasons: string[] = [];
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
      if (currentState === 'pending') {
        nodeStates[taskNodeId] = applyTaskNodeTransition({
          currentState,
          nextState: 'ready',
        });
      }

      nodeStates[taskNodeId] = applyTaskNodeTransition({
        currentState: nodeStates[taskNodeId] ?? 'ready',
        nextState: 'running',
      });
    }

    if (entry.eventType === 'node_execution_completed') {
      nodeStates[taskNodeId] = applyTaskNodeTransition({
        currentState,
        nextState: 'completed',
      });
    }

    if (entry.eventType === 'node_execution_failed') {
      nodeStates[taskNodeId] = applyTaskNodeTransition({
        currentState,
        nextState: 'failed',
      });
      blockingReasons.push(`task_failed:${taskNodeId}`);
    }
  }

  return {
    nodeStates,
    steps: [...steps].sort(compareSteps),
    blockingReasons: uniqueSorted(blockingReasons),
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

    const readyFromPending = detectReadyTaskNodeIds({
      taskGraph,
      nodeStates: replayed.nodeStates,
    });

    const projectedNodeStates: Record<string, TaskExecutionNodeState> = {
      ...replayed.nodeStates,
    };

    for (const taskNodeId of readyFromPending) {
      projectedNodeStates[taskNodeId] = 'ready';
    }

    const nodeStateValues = Object.values(projectedNodeStates);
    const readyNodeCount = nodeStateValues.filter((state) => state === 'ready').length;
    const runningNodeCount = nodeStateValues.filter((state) => state === 'running').length;
    const completedNodeCount = nodeStateValues.filter((state) => state === 'completed').length;
    const blockedNodeCount = nodeStateValues.filter((state) => state === 'blocked' || state === 'failed').length;

    const graphState = deriveGraphState({
      totalNodeCount: taskGraph.nodeCount,
      readyNodeCount,
      runningNodeCount,
      completedNodeCount,
      blockedNodeCount,
    });

    const blockingReasons = uniqueSorted([
      ...taskGraph.blockingReasons,
      ...replayed.blockingReasons,
      ...(graphState === 'blocked' && readyNodeCount === 0 && completedNodeCount !== taskGraph.nodeCount
        ? ['TASK_GRAPH_BLOCKED']
        : []),
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
      readyNodeCount,
      runningNodeCount,
      completedNodeCount,
      blockedNodeCount,
      graphState,
      executionProgress,
      blockingReasons,
      lastExecutionStepId,
    } as Record<string, unknown>;

    const reportPreview = {
      executionEngineRunId: taskGraph.executionEngineRunId,
      executionAttemptId: taskGraph.executionAttemptId,
      taskGraphId: taskGraph.taskGraphId,
      graphState,
      engineState,
      nodeStates: Object.fromEntries(Object.entries(projectedNodeStates).sort(([left], [right]) => left.localeCompare(right))),
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
      readyNodeCount,
      runningNodeCount,
      completedNodeCount,
      blockedNodeCount,
      graphState,
      executionProgress,
      blockingReasons,
      lastExecutionStepId,
      engineState,
      steps,
      nodeStates: Object.fromEntries(Object.entries(projectedNodeStates).sort(([left], [right]) => left.localeCompare(right))),
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
