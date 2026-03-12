import { createTaskGraphProjection, type TaskGraphProjectionEngine } from '../task-graph/task-graph-projection.ts';

import { createTaskExecutionHistoryStore, type TaskExecutionHistoryStore } from './task-execution-history-store.ts';
import { createTaskExecutionProjection, type TaskExecutionProjectionEngine } from './task-execution-projection.ts';
import {
  dependenciesSatisfiedForTaskRetry,
  scheduleTaskRetry,
} from './task-retry-scheduler.ts';
import {
  evaluateTaskRetryEligibility,
  type MissionTaskRetryPolicy,
} from './task-retry-policy.ts';
import { deriveTaskWorkerProjection } from './task-worker-projection.ts';
import type { WorkerFailureClass, WorkerResultType } from './task-execution-step-types.ts';

function retryCountForNode(input: {
  projected: ReturnType<TaskExecutionProjectionEngine['projectOne']>;
  taskNodeId: string;
}): number {
  const counts = input.projected.retryAttempts
    .filter((attempt) => attempt.taskNodeId === input.taskNodeId)
    .map((attempt) => attempt.retryCount)
    .sort((left, right) => right - left);

  return counts[0] ?? 0;
}

function normalizeResultType(value: string): WorkerResultType {
  if (value === 'SUCCESS' || value === 'FAILURE' || value === 'RETRY_REQUESTED') {
    return value;
  }

  throw new Error('INVALID_TASK_WORK_CLAIM');
}

function normalizeFailureClass(value: string | undefined): WorkerFailureClass {
  if (
    value === 'RETRYABLE_FAILURE'
    || value === 'NON_RETRYABLE_FAILURE'
    || value === 'SYSTEM_FAILURE'
    || value === 'POLICY_FAILURE'
    || value === 'DEPENDENCY_FAILURE'
  ) {
    return value;
  }

  throw new Error('INVALID_TASK_WORK_CLAIM');
}

export function createTaskWorkerResultHandler(options: {
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
  const historyStore = options.historyStore ?? createTaskExecutionHistoryStore({
    artifactsRoot: options.taskExecutionArtifactsRoot,
  });

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

  const projection = options.projection ?? createTaskExecutionProjection({
    historyStore,
    taskGraphProjection,
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

  function handleResult(input: {
    taskGraphId: string;
    executionRunId: string;
    taskNodeId: string;
    workerId: string;
    claimId: string;
    attemptIndex: number;
    resultType: 'SUCCESS' | 'FAILURE' | 'RETRY_REQUESTED';
    resultPayload: Record<string, unknown>;
    failureClass?: WorkerFailureClass;
    retryEligible?: boolean;
  }) {
    if (!Number.isInteger(input.attemptIndex) || input.attemptIndex < 0) {
      throw new Error('INVALID_TASK_WORK_CLAIM');
    }

    const projected = projection.projectOne({ taskGraphId: input.taskGraphId });
    if (projected.executionEngineRunId !== input.executionRunId) {
      throw new Error('INVALID_TASK_WORK_CLAIM');
    }

    if (projected.nodeStates[input.taskNodeId] !== 'ready' && projected.nodeStates[input.taskNodeId] !== 'running') {
      throw new Error('INVALID_TASK_WORK_CLAIM');
    }

    const history = historyStore.load({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
    });

    const workerProjection = deriveTaskWorkerProjection({ historyEntries: history.entries });
    const claimState = Object.values(workerProjection.workerExecutionState).find((state) => (
      state.taskNodeId === input.taskNodeId
      && state.workerId === input.workerId
      && state.claimId === input.claimId
      && state.attemptIndex === input.attemptIndex
    ));

    if (!claimState) {
      throw new Error('INVALID_TASK_WORK_CLAIM');
    }

    const resultType = normalizeResultType(input.resultType);

    historyStore.append({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
      eventType: 'worker_execution_started',
      eventPayload: {
        executionRunId: projected.executionEngineRunId,
        taskGraphId: projected.taskGraphId,
        taskNodeId: input.taskNodeId,
        workerId: input.workerId,
        claimId: input.claimId,
        attemptIndex: input.attemptIndex,
      },
    });

    historyStore.append({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
      eventType: 'node_execution_started',
      eventPayload: {
        taskNodeId: input.taskNodeId,
        trigger: 'worker_result_handler',
        workerId: input.workerId,
        claimId: input.claimId,
        attemptIndex: input.attemptIndex,
      },
    });

    if (resultType === 'SUCCESS') {
      historyStore.append({
        executionEngineRunId: projected.executionEngineRunId,
        executionAttemptId: projected.executionAttemptId,
        taskGraphId: projected.taskGraphId,
        eventType: 'worker_execution_completed',
        eventPayload: {
          executionRunId: projected.executionEngineRunId,
          taskGraphId: projected.taskGraphId,
          taskNodeId: input.taskNodeId,
          workerId: input.workerId,
          claimId: input.claimId,
          attemptIndex: input.attemptIndex,
          resultType: 'SUCCESS',
          resultPayload: input.resultPayload,
        },
      });

      historyStore.append({
        executionEngineRunId: projected.executionEngineRunId,
        executionAttemptId: projected.executionAttemptId,
        taskGraphId: projected.taskGraphId,
        eventType: 'node_execution_completed',
        eventPayload: {
          taskNodeId: input.taskNodeId,
          workerId: input.workerId,
          claimId: input.claimId,
          attemptIndex: input.attemptIndex,
          resultPayload: input.resultPayload,
        },
      });

      return {
        resultType: 'SUCCESS' as const,
        projection: projection.projectOne({ taskGraphId: input.taskGraphId }),
      };
    }

    const failureClass = normalizeFailureClass(input.failureClass);
    const retryEligibleFlag = typeof input.retryEligible === 'boolean' ? input.retryEligible : false;

    historyStore.append({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
      eventType: 'worker_execution_failed',
      eventPayload: {
        executionRunId: projected.executionEngineRunId,
        taskGraphId: projected.taskGraphId,
        taskNodeId: input.taskNodeId,
        workerId: input.workerId,
        claimId: input.claimId,
        attemptIndex: input.attemptIndex,
        resultType,
        resultPayload: input.resultPayload,
        failureClass,
        retryEligible: retryEligibleFlag,
      },
    });

    historyStore.append({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
      eventType: 'node_execution_failed',
      eventPayload: {
        taskNodeId: input.taskNodeId,
        failureClass,
        failureCode: 'WORKER_EXECUTION_FAILURE',
        workerId: input.workerId,
        claimId: input.claimId,
        attemptIndex: input.attemptIndex,
      },
    });

    const taskGraph = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId });
    const taskNode = taskGraph.taskNodes.find((node) => node.taskNodeId === input.taskNodeId);
    if (!taskNode) {
      throw new Error('TASK_NODE_NOT_READY');
    }

    const projectedAfterFailure = projection.projectOne({ taskGraphId: input.taskGraphId });

    const evaluation = evaluateTaskRetryEligibility({
      policy: taskNode.retryPolicy as Partial<MissionTaskRetryPolicy> | undefined,
      failureClass,
      currentRetryCount: retryCountForNode({
        projected: projectedAfterFailure,
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

    if (!evaluation.eligible || !retryEligibleFlag) {
      historyStore.append({
        executionEngineRunId: projected.executionEngineRunId,
        executionAttemptId: projected.executionAttemptId,
        taskGraphId: projected.taskGraphId,
        eventType: 'node_retry_exhausted',
        eventPayload: {
          taskNodeId: input.taskNodeId,
          attemptIndex: evaluation.attemptIndex,
          retryPolicyId: evaluation.policy.retryPolicyId,
          reason: evaluation.eligible ? 'worker_marked_not_retry_eligible' : evaluation.reason,
        },
      });

      return {
        resultType,
        retryScheduled: false,
        projection: projection.projectOne({ taskGraphId: input.taskGraphId }),
      };
    }

    const dependencySatisfied = dependenciesSatisfiedForTaskRetry({
      taskGraph,
      taskNodeId: input.taskNodeId,
      nodeStates: projectedAfterFailure.nodeStates,
    });

    const scheduledQueue = scheduleTaskRetry({
      queue: [],
      taskNodeId: input.taskNodeId,
      attemptIndex: evaluation.attemptIndex,
      dependencySatisfied,
    });

    historyStore.append({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
      eventType: 'node_retry_scheduled',
      eventPayload: {
        taskNodeId: input.taskNodeId,
        retryAttempt,
        retryDelay: evaluation.retryDelay,
        scheduledQueue,
      },
    });

    if (dependencySatisfied) {
      historyStore.append({
        executionEngineRunId: projected.executionEngineRunId,
        executionAttemptId: projected.executionAttemptId,
        taskGraphId: projected.taskGraphId,
        eventType: 'node_retry_started',
        eventPayload: {
          taskNodeId: input.taskNodeId,
          retryAttempt: {
            ...retryAttempt,
            retryState: 'started',
          },
        },
      });
    }

    return {
      resultType,
      retryScheduled: true,
      retryStarted: dependencySatisfied,
      projection: projection.projectOne({ taskGraphId: input.taskGraphId }),
    };
  }

  return {
    handleResult,
  };
}

export type TaskWorkerResultHandler = ReturnType<typeof createTaskWorkerResultHandler>;
