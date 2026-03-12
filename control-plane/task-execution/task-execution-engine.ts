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
import { applyTaskNodeTransition } from './task-node-transition.ts';
import {
  DEFAULT_TASK_CONCURRENCY_POLICY_ID,
  getTaskConcurrencyPolicy,
} from './task-concurrency-policies.ts';
import { evaluateRunnableNodeSet } from './task-runnable-node-set.ts';
import { computeSchedulingWave } from './task-concurrency-scheduler.ts';
import { createConcurrencyWaveEvents } from './task-concurrency-history.ts';
import {
  classifyTaskFailure,
  type TaskFailureClass,
} from './task-failure-classifier.ts';
import {
  evaluateTaskRetryEligibility,
  type MissionTaskRetryPolicy,
} from './task-retry-policy.ts';
import {
  dependenciesSatisfiedForTaskRetry,
  scheduleTaskRetry,
} from './task-retry-scheduler.ts';
import {
  createTaskExecutionOrchestrator,
  type TaskExecutionOrchestrator,
} from './task-execution-orchestrator.ts';
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

function currentRetryCountForNode(input: {
  projected: MissionTaskExecutionProjection;
  taskNodeId: string;
}): number {
  const counts = input.projected.retryAttempts
    .filter((attempt) => attempt.taskNodeId === input.taskNodeId)
    .map((attempt) => attempt.retryCount)
    .sort((left, right) => right - left);

  return counts[0] ?? 0;
}

function latestFailureClassForNode(input: {
  projected: MissionTaskExecutionProjection;
  taskNodeId: string;
}): TaskFailureClass {
  const failureStep = [...input.projected.steps]
    .sort((left, right) => right.stepIndex - left.stepIndex)
    .find((step) => step.taskNodeId === input.taskNodeId && step.stepType === 'node_execution_failed');

  const failureClass = failureStep?.stepOutputs.failureClass;
  if (
    failureClass === 'RETRYABLE_FAILURE'
    || failureClass === 'NON_RETRYABLE_FAILURE'
    || failureClass === 'SYSTEM_FAILURE'
    || failureClass === 'POLICY_FAILURE'
    || failureClass === 'DEPENDENCY_FAILURE'
  ) {
    return failureClass;
  }

  return 'NON_RETRYABLE_FAILURE';
}

function attemptIndexByNode(projection: MissionTaskExecutionProjection): Record<string, number> {
  const attemptByNode = new Map<string, number>();

  for (const attempt of [...projection.retryAttempts].sort((left, right) => {
    const byNode = left.taskNodeId.localeCompare(right.taskNodeId);
    if (byNode !== 0) {
      return byNode;
    }
    return left.attemptIndex - right.attemptIndex;
  })) {
    attemptByNode.set(attempt.taskNodeId, attempt.attemptIndex);
  }

  return Object.fromEntries(
    [...attemptByNode.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function createTaskExecutionEngine(options: {
  projection?: TaskExecutionProjectionEngine;
  historyStore?: TaskExecutionHistoryStore;
  taskGraphProjection?: TaskGraphProjectionEngine;
  orchestrator?: TaskExecutionOrchestrator;
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

  const orchestrator = options.orchestrator ?? createTaskExecutionOrchestrator({
    projection,
    taskGraphProjection,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
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

  function appendStepEvent(input: {
    projectedBefore: MissionTaskExecutionProjection;
    taskNodeId: string | null;
    stepType: TaskExecutionStepType;
    stepInputs: Record<string, unknown>;
    stepOutputs: Record<string, unknown>;
    eventPayloadExtras?: Record<string, unknown>;
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
        ...(input.eventPayloadExtras ?? {}),
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
    const projectedInitial = projection.projectOne({ taskGraphId: input.taskGraphId });

    if (projectedInitial.graphState === 'completed') {
      throw new Error('TASK_EXECUTION_ALREADY_COMPLETED');
    }

    if (projectedInitial.graphState === 'failed') {
      throw new Error('TASK_GRAPH_BLOCKED');
    }

    const taskGraph = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId });
    const historyBefore = historyStore.load({
      executionEngineRunId: projectedInitial.executionEngineRunId,
      executionAttemptId: projectedInitial.executionAttemptId,
      taskGraphId: projectedInitial.taskGraphId,
    });

    const concurrencyPolicy = getTaskConcurrencyPolicy(DEFAULT_TASK_CONCURRENCY_POLICY_ID);
    const runnableSet = evaluateRunnableNodeSet(
      taskGraph,
      projectedInitial,
      historyBefore,
      concurrencyPolicy,
    );

    if (runnableSet.runnableNodeCount === 0) {
      throw new Error('TASK_GRAPH_BLOCKED');
    }

    const wave = computeSchedulingWave(runnableSet, concurrencyPolicy, projectedInitial);
    const steps: MissionTaskExecutionStep[] = [];
    let projectedCurrent = projectedInitial;

    for (const event of createConcurrencyWaveEvents({
      wave,
      attemptIndexByNode: attemptIndexByNode(projectedInitial),
    })) {
      const taskNodeId = typeof event.eventPayload.taskNodeId === 'string'
        ? event.eventPayload.taskNodeId
        : null;
      const appended = appendStepEvent({
        projectedBefore: projectedCurrent,
        taskNodeId,
        stepType: event.eventType,
        stepInputs: event.eventPayload,
        stepOutputs: event.eventPayload,
        eventPayloadExtras: event.eventPayload,
      });
      steps.push(appended);
      projectedCurrent = projection.projectOne({ taskGraphId: input.taskGraphId });
    }

    for (const taskNodeId of wave.scheduledNodeIds) {
      applyTaskNodeTransition({ currentState: 'ready', nextState: 'running' });
      const startedStep = appendStepEvent({
        projectedBefore: projectedCurrent,
        taskNodeId,
        stepType: 'node_execution_started',
        stepInputs: {
          taskNodeId,
          runnableNodeIds: runnableSet.runnableNodeIds,
          scheduledNodeIds: wave.scheduledNodeIds,
          waveIndex: wave.waveIndex,
        },
        stepOutputs: {
          nextTaskNodeState: 'running',
        },
      });
      steps.push(startedStep);
      projectedCurrent = projection.projectOne({ taskGraphId: input.taskGraphId });

      applyTaskNodeTransition({ currentState: 'running', nextState: 'completed' });
      const completedStep = appendStepEvent({
        projectedBefore: projectedCurrent,
        taskNodeId,
        stepType: 'node_execution_completed',
        stepInputs: {
          taskNodeId,
          waveIndex: wave.waveIndex,
        },
        stepOutputs: {
          nextTaskNodeState: 'completed',
        },
      });
      steps.push(completedStep);
      projectedCurrent = projection.projectOne({ taskGraphId: input.taskGraphId });
    }

    if (projectedCurrent.completedNodeCount === projectedCurrent.executionProgress.total) {
      appendStepEvent({
        projectedBefore: projectedCurrent,
        taskNodeId: null,
        stepType: 'graph_execution_completed',
        stepInputs: {
          completedNodeCount: projectedCurrent.completedNodeCount,
          totalNodeCount: projectedCurrent.executionProgress.total,
        },
        stepOutputs: {
          graphState: 'completed',
        },
      });
    } else {
      appendStepEvent({
        projectedBefore: projectedCurrent,
        taskNodeId: null,
        stepType: 'graph_execution_progressed',
        stepInputs: {
          completedNodeCount: projectedCurrent.completedNodeCount,
          totalNodeCount: projectedCurrent.executionProgress.total,
        },
        stepOutputs: {
          graphState: projectedCurrent.graphState,
        },
      });
    }

    const projectedAfter = projection.projectOne({ taskGraphId: input.taskGraphId });
    const orchestration = orchestrator.cycle({ taskGraphId: input.taskGraphId });

    return {
      selectedTaskNodeId: wave.scheduledNodeIds[0] ?? null,
      scheduledNodeIds: wave.scheduledNodeIds,
      deferredNodeIds: wave.deferredNodeIds,
      waveIndex: wave.waveIndex,
      concurrencyPolicyId: wave.concurrencyPolicyId,
      steps: [...steps].sort(compareSteps),
      projection: projectedAfter,
      orchestration,
    };
  }

  function failNode(input: {
    taskGraphId: string;
    taskNodeId: string;
    failureCode?: string;
    failureClass?: TaskFailureClass;
  }) {
    const steps: MissionTaskExecutionStep[] = [];

    const projectedBefore = projection.projectOne({ taskGraphId: input.taskGraphId });
    const currentState = projectedBefore.nodeStates[input.taskNodeId];

    if (!currentState) {
      throw new Error('TASK_NODE_NOT_READY');
    }

    if (currentState !== 'ready' && currentState !== 'running') {
      throw new Error('TASK_NODE_NOT_READY');
    }

    let projectedAtFailure = projectedBefore;

    if (currentState === 'ready') {
      applyTaskNodeTransition({ currentState: 'ready', nextState: 'running' });
      const startedStep = appendStepEvent({
        projectedBefore,
        taskNodeId: input.taskNodeId,
        stepType: 'node_execution_started',
        stepInputs: {
          taskNodeId: input.taskNodeId,
          trigger: 'explicit_failure_transition',
        },
        stepOutputs: {
          nextTaskNodeState: 'running',
        },
      });
      steps.push(startedStep);
      projectedAtFailure = projection.projectOne({ taskGraphId: input.taskGraphId });
    }

    const classified = classifyTaskFailure({
      failureCode: input.failureCode,
      explicitFailureClass: input.failureClass,
    });

    applyTaskNodeTransition({ currentState: 'running', nextState: 'failed' });
    const failedStep = appendStepEvent({
      projectedBefore: projectedAtFailure,
      taskNodeId: input.taskNodeId,
      stepType: 'node_execution_failed',
      stepInputs: {
        taskNodeId: input.taskNodeId,
        failureCode: classified.normalizedFailureCode,
      },
      stepOutputs: {
        nextTaskNodeState: 'failed',
        failureClass: classified.failureClass,
      },
      eventPayloadExtras: {
        failureCode: classified.normalizedFailureCode,
        failureClass: classified.failureClass,
        classifierPolicyId: classified.classifierPolicyId,
      },
    });
    steps.push(failedStep);

    return {
      taskNodeId: input.taskNodeId,
      failureClass: classified.failureClass,
      steps: [...steps].sort(compareSteps),
      projection: projection.projectOne({ taskGraphId: input.taskGraphId }),
    };
  }

  function retryNode(input: {
    taskGraphId: string;
    taskNodeId: string;
  }) {
    const projectedBefore = projection.projectOne({ taskGraphId: input.taskGraphId });
    const currentState = projectedBefore.nodeStates[input.taskNodeId];

    if (!currentState || currentState !== 'failed') {
      throw new Error('TASK_NODE_NOT_READY');
    }

    const taskGraph = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId });
    const taskNode = taskGraph.taskNodes.find((node) => node.taskNodeId === input.taskNodeId);
    if (!taskNode) {
      throw new Error('TASK_NODE_NOT_READY');
    }

    const failureClass = latestFailureClassForNode({
      projected: projectedBefore,
      taskNodeId: input.taskNodeId,
    });

    const evaluation = evaluateTaskRetryEligibility({
      policy: taskNode.retryPolicy as Partial<MissionTaskRetryPolicy> | undefined,
      failureClass,
      currentRetryCount: currentRetryCountForNode({
        projected: projectedBefore,
        taskNodeId: input.taskNodeId,
      }),
    });

    const retryAttempt = {
      taskNodeId: input.taskNodeId,
      attemptIndex: evaluation.attemptIndex,
      failureClass,
      retryPolicyId: evaluation.policy.retryPolicyId,
      retryState: 'scheduled',
      retryCount: evaluation.retryCount,
    };

    if (!evaluation.eligible) {
      appendStepEvent({
        projectedBefore,
        taskNodeId: input.taskNodeId,
        stepType: 'node_retry_exhausted',
        stepInputs: {
          taskNodeId: input.taskNodeId,
          reason: evaluation.reason,
        },
        stepOutputs: {
          nextTaskNodeState: 'permanently_failed',
          reason: evaluation.reason,
        },
        eventPayloadExtras: {
          attemptIndex: evaluation.attemptIndex,
          retryPolicyId: evaluation.policy.retryPolicyId,
          reason: evaluation.reason,
        },
      });

      return {
        taskNodeId: input.taskNodeId,
        retryScheduled: false,
        reason: evaluation.reason,
        projection: projection.projectOne({ taskGraphId: input.taskGraphId }),
      };
    }

    const dependencySatisfied = dependenciesSatisfiedForTaskRetry({
      taskGraph,
      taskNodeId: input.taskNodeId,
      nodeStates: projectedBefore.nodeStates,
    });

    const scheduledQueue = scheduleTaskRetry({
      queue: [],
      taskNodeId: input.taskNodeId,
      attemptIndex: evaluation.attemptIndex,
      dependencySatisfied,
    });

    const scheduled = appendStepEvent({
      projectedBefore,
      taskNodeId: input.taskNodeId,
      stepType: 'node_retry_scheduled',
      stepInputs: {
        taskNodeId: input.taskNodeId,
        retryAttempt: evaluation.attemptIndex,
        retryDelay: evaluation.retryDelay,
      },
      stepOutputs: {
        nextTaskNodeState: 'retrying',
        dependencySatisfied,
      },
      eventPayloadExtras: {
        retryAttempt,
        retryDelay: evaluation.retryDelay,
        scheduledQueue,
      },
    });

    if (!dependencySatisfied) {
      return {
        taskNodeId: input.taskNodeId,
        retryScheduled: true,
        retryStarted: false,
        steps: [scheduled],
        projection: projection.projectOne({ taskGraphId: input.taskGraphId }),
      };
    }

    const projectedAfterSchedule = projection.projectOne({ taskGraphId: input.taskGraphId });

    const started = appendStepEvent({
      projectedBefore: projectedAfterSchedule,
      taskNodeId: input.taskNodeId,
      stepType: 'node_retry_started',
      stepInputs: {
        taskNodeId: input.taskNodeId,
        retryAttempt: evaluation.attemptIndex,
      },
      stepOutputs: {
        nextTaskNodeState: 'ready',
      },
      eventPayloadExtras: {
        retryAttempt: {
          ...retryAttempt,
          retryState: 'started',
        },
      },
    });

    return {
      taskNodeId: input.taskNodeId,
      retryScheduled: true,
      retryStarted: true,
      steps: [scheduled, started].sort(compareSteps),
      projection: projection.projectOne({ taskGraphId: input.taskGraphId }),
    };
  }

  function advance(input: {
    taskGraphId: string;
  }) {
    const steps: MissionTaskExecutionStep[] = [];
    const limit = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId }).nodeCount + 1;

    for (let index = 0; index < limit; index += 1) {
      const current = projection.projectOne({ taskGraphId: input.taskGraphId });

      if (current.graphState === 'completed' || current.graphState === 'failed') {
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
      if (current.graphState === 'completed' || current.graphState === 'failed') {
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
    failNode,
    retryNode,
    advance,
    simulate,
  };
}

export type TaskExecutionEngine = ReturnType<typeof createTaskExecutionEngine>;
