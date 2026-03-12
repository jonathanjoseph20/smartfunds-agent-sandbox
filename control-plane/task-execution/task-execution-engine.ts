import {
  createTaskGraphProjection,
  type TaskGraphProjectionEngine,
} from '../task-graph/task-graph-projection.ts';
import { canonicalStringify } from '../finance/determinism.ts';

import {
  createTaskExecutionHistoryStore,
  type TaskExecutionHistoryStore,
} from './task-execution-history-store.ts';
import {
  createTaskExecutionProjection,
  type TaskExecutionProjectionEngine,
} from './task-execution-projection.ts';
import { deriveTaskExecutionStepId } from './task-execution-step-identity.ts';
import { deriveTaskGraphTopologicalOrder } from './task-ready-node-detector.ts';
import { applyTaskNodeTransition } from './task-node-transition.ts';
import type { MissionTaskExecutionProjection, MissionTaskExecutionStep, TaskExecutionStepType } from './task-execution-step-types.ts';

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

function selectReadyNodeId(input: {
  readyNodeIds: string[];
  topologicalOrder: string[];
}): string | null {
  if (input.readyNodeIds.length === 0) {
    return null;
  }

  const orderIndex = new Map(input.topologicalOrder.map((nodeId, index) => [nodeId, index]));
  return [...input.readyNodeIds]
    .sort((left, right) => {
      const leftIndex = orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER;
      const byTopo = leftIndex - rightIndex;
      if (byTopo !== 0) {
        return byTopo;
      }
      return left.localeCompare(right);
    })[0] ?? null;
}

export function createTaskExecutionEngine(options: {
  projection?: TaskExecutionProjectionEngine;
  historyStore?: TaskExecutionHistoryStore;
  taskGraphProjection?: TaskGraphProjectionEngine;
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

  const projection = options.projection ?? createTaskExecutionProjection({
    taskGraphProjection,
    historyStore,
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
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
  });

  function appendStepEvent(input: {
    projectedBefore: MissionTaskExecutionProjection;
    taskNodeId: string | null;
    stepType: TaskExecutionStepType;
    stepInputs: Record<string, unknown>;
    stepOutputs: Record<string, unknown>;
  }): MissionTaskExecutionStep {
    const stepIndex = input.projectedBefore.executionStepCount;

    const executionStepId = deriveTaskExecutionStepId({
      executionEngineRunId: input.projectedBefore.executionEngineRunId,
      taskGraphId: input.projectedBefore.taskGraphId,
      taskNodeId: input.taskNodeId,
      stepType: input.stepType,
      stepInputs: input.stepInputs,
    });

    const baseStep: MissionTaskExecutionStep = {
      executionStepId,
      executionEngineRunId: input.projectedBefore.executionEngineRunId,
      executionAttemptId: input.projectedBefore.executionAttemptId,
      taskGraphId: input.projectedBefore.taskGraphId,
      taskNodeId: input.taskNodeId,
      stepIndex,
      stepType: input.stepType,
      stepState: 'accepted',
      stepInputs: normalizeRecord(input.stepInputs),
      stepOutputs: normalizeRecord(input.stepOutputs),
      eventDedupeKey: '',
    };

    const appended = historyStore.append({
      executionEngineRunId: input.projectedBefore.executionEngineRunId,
      executionAttemptId: input.projectedBefore.executionAttemptId,
      taskGraphId: input.projectedBefore.taskGraphId,
      eventType: input.stepType,
      eventPayload: {
        executionStepId,
        taskNodeId: input.taskNodeId,
        step: baseStep,
      },
    });

    const step: MissionTaskExecutionStep = {
      ...baseStep,
      stepState: appended.appended ? 'accepted' : 'deduped',
      eventDedupeKey: appended.entry.eventDedupeKey,
    };

    return step;
  }

  function step(input: {
    taskGraphId: string;
  }) {
    const projectedBefore = projection.projectOne({ taskGraphId: input.taskGraphId });

    if (projectedBefore.graphState === 'completed') {
      throw new Error('TASK_EXECUTION_ALREADY_COMPLETED');
    }

    const taskGraph = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId });
    const topologicalOrder = deriveTaskGraphTopologicalOrder(taskGraph);

    const readyNodeIds = Object.entries(projectedBefore.nodeStates)
      .filter(([, state]) => state === 'ready')
      .map(([taskNodeId]) => taskNodeId)
      .sort((left, right) => left.localeCompare(right));

    const selectedTaskNodeId = selectReadyNodeId({ readyNodeIds, topologicalOrder });

    if (!selectedTaskNodeId) {
      throw new Error('TASK_GRAPH_BLOCKED');
    }

    applyTaskNodeTransition({ currentState: 'ready', nextState: 'running' });
    const startedStep = appendStepEvent({
      projectedBefore,
      taskNodeId: selectedTaskNodeId,
      stepType: 'node_execution_started',
      stepInputs: {
        taskNodeId: selectedTaskNodeId,
        readyNodeIds,
      },
      stepOutputs: {
        nextTaskNodeState: 'running',
      },
    });

    const projectedAfterStart = projection.projectOne({ taskGraphId: input.taskGraphId });

    applyTaskNodeTransition({ currentState: 'running', nextState: 'completed' });
    const completedStep = appendStepEvent({
      projectedBefore: projectedAfterStart,
      taskNodeId: selectedTaskNodeId,
      stepType: 'node_execution_completed',
      stepInputs: {
        taskNodeId: selectedTaskNodeId,
      },
      stepOutputs: {
        nextTaskNodeState: 'completed',
      },
    });

    const projectedAfterComplete = projection.projectOne({ taskGraphId: input.taskGraphId });

    if (projectedAfterComplete.completedNodeCount === projectedAfterComplete.executionProgress.total) {
      appendStepEvent({
        projectedBefore: projectedAfterComplete,
        taskNodeId: null,
        stepType: 'graph_execution_completed',
        stepInputs: {
          completedNodeCount: projectedAfterComplete.completedNodeCount,
          totalNodeCount: projectedAfterComplete.executionProgress.total,
        },
        stepOutputs: {
          graphState: 'completed',
        },
      });
    } else {
      appendStepEvent({
        projectedBefore: projectedAfterComplete,
        taskNodeId: null,
        stepType: 'graph_execution_progressed',
        stepInputs: {
          completedNodeCount: projectedAfterComplete.completedNodeCount,
          totalNodeCount: projectedAfterComplete.executionProgress.total,
        },
        stepOutputs: {
          graphState: projectedAfterComplete.graphState,
        },
      });
    }

    const projectedAfter = projection.projectOne({ taskGraphId: input.taskGraphId });

    return {
      selectedTaskNodeId,
      steps: [startedStep, completedStep].sort(compareSteps),
      projection: projectedAfter,
    };
  }

  function advance(input: {
    taskGraphId: string;
  }) {
    const steps: MissionTaskExecutionStep[] = [];
    const limit = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId }).nodeCount + 1;

    for (let index = 0; index < limit; index += 1) {
      const current = projection.projectOne({ taskGraphId: input.taskGraphId });

      if (current.graphState === 'completed') {
        return {
          mode: 'advance' as const,
          steps: [...steps].sort(compareSteps),
          projection: current,
        };
      }

      try {
        const result = step(input);
        steps.push(...result.steps);
      } catch (error) {
        const message = (error as Error).message;
        if (message === 'TASK_GRAPH_BLOCKED') {
          return {
            mode: 'advance' as const,
            steps: [...steps].sort(compareSteps),
            projection: projection.projectOne({ taskGraphId: input.taskGraphId }),
          };
        }
        throw error;
      }
    }

    throw new Error('TASK_EXECUTION_STEP_INVALID');
  }

  function simulate(input: {
    taskGraphId: string;
  }) {
    const steps: MissionTaskExecutionStep[] = [];
    const limit = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId }).nodeCount + 1;

    for (let index = 0; index < limit; index += 1) {
      const current = projection.projectOne({ taskGraphId: input.taskGraphId });
      if (current.graphState === 'completed') {
        return {
          mode: 'simulate' as const,
          steps: [...steps].sort(compareSteps),
          projection: current,
        };
      }

      const result = step(input);
      steps.push(...result.steps);
    }

    const finalProjection = projection.projectOne({ taskGraphId: input.taskGraphId });
    if (finalProjection.graphState !== 'completed') {
      throw new Error('TASK_GRAPH_BLOCKED');
    }

    return {
      mode: 'simulate' as const,
      steps: [...steps].sort(compareSteps),
      projection: finalProjection,
    };
  }

  return {
    step,
    advance,
    simulate,
  };
}

export type TaskExecutionEngine = ReturnType<typeof createTaskExecutionEngine>;
