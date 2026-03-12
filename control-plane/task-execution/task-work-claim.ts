import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { createTaskGraphProjection, type TaskGraphProjectionEngine } from '../task-graph/task-graph-projection.ts';
import { loadWorkerRegistry, type WorkerRegistry } from '../workers/worker-registry.ts';

import { createTaskExecutionHistoryStore, type TaskExecutionHistoryStore } from './task-execution-history-store.ts';
import { createTaskExecutionProjection, type TaskExecutionProjectionEngine } from './task-execution-projection.ts';
import { deriveTaskWorkerProjection } from './task-worker-projection.ts';
import type { MissionTaskWorkerClaim } from './task-execution-step-types.ts';

export function deriveTaskWorkClaimId(input: {
  executionRunId: string;
  taskNodeId: string;
  workerId: string;
  claimAttemptIndex: number;
}): string {
  return sha256(canonicalStringify({
    executionRunId: input.executionRunId,
    taskNodeId: input.taskNodeId,
    workerId: input.workerId,
    claimAttemptIndex: input.claimAttemptIndex,
  }));
}

function latestAttemptByNode(input: {
  projection: ReturnType<TaskExecutionProjectionEngine['projectOne']>;
  taskNodeId: string;
}): number {
  const attempts = input.projection.retryAttempts
    .filter((attempt) => attempt.taskNodeId === input.taskNodeId)
    .map((attempt) => attempt.attemptIndex)
    .sort((left, right) => right - left);

  return attempts[0] ?? 0;
}

export function createTaskWorkClaimService(options: {
  projection?: TaskExecutionProjectionEngine;
  historyStore?: TaskExecutionHistoryStore;
  taskGraphProjection?: TaskGraphProjectionEngine;
  workerRegistry?: WorkerRegistry;
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
  workerDefinitionsDir?: string;
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

  const workerRegistry = options.workerRegistry ?? loadWorkerRegistry({
    definitionsDir: options.workerDefinitionsDir,
  });

  function claimWork(input: {
    taskGraphId: string;
    taskNodeId: string;
    workerId: string;
    claimAttemptIndex: number;
  }): { claim: MissionTaskWorkerClaim; appended: boolean } {
    if (!Number.isInteger(input.claimAttemptIndex) || input.claimAttemptIndex < 0) {
      throw new Error('INVALID_TASK_WORK_CLAIM');
    }

    const projected = projection.projectOne({ taskGraphId: input.taskGraphId });
    const taskGraph = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId });

    if (projected.nodeStates[input.taskNodeId] !== 'ready') {
      throw new Error('INVALID_TASK_WORK_CLAIM');
    }

    const taskNode = taskGraph.taskNodes.find((node) => node.taskNodeId === input.taskNodeId);
    if (!taskNode) {
      throw new Error('INVALID_TASK_WORK_CLAIM');
    }

    if (!workerRegistry.validateWorkerSupportsTask(input.workerId, taskNode.taskType)) {
      throw new Error('INVALID_TASK_WORK_CLAIM');
    }

    if (!workerRegistry.validateWorkerCapabilities(input.workerId, taskNode.requiredCapabilities)) {
      throw new Error('INVALID_TASK_WORK_CLAIM');
    }

    const history = historyStore.load({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
    });

    const workerProjection = deriveTaskWorkerProjection({
      historyEntries: history.entries,
    });

    const alreadyClaimed = Object.values(workerProjection.workerExecutionState)
      .some((state) => (
        state.taskNodeId === input.taskNodeId
        && (state.state === 'claimed' || state.state === 'running')
      ));

    if (alreadyClaimed) {
      throw new Error('INVALID_TASK_WORK_CLAIM');
    }

    const attemptIndex = latestAttemptByNode({
      projection: projected,
      taskNodeId: input.taskNodeId,
    });

    const claimId = deriveTaskWorkClaimId({
      executionRunId: projected.executionEngineRunId,
      taskNodeId: input.taskNodeId,
      workerId: input.workerId,
      claimAttemptIndex: input.claimAttemptIndex,
    });

    const claim: MissionTaskWorkerClaim = {
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
      taskNodeId: input.taskNodeId,
      workerId: input.workerId,
      claimId,
      claimAttemptIndex: input.claimAttemptIndex,
      attemptIndex,
    };

    const appended = historyStore.append({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
      eventType: 'task_node_claimed',
      eventPayload: claim,
    });

    return {
      claim,
      appended: appended.appended,
    };
  }

  return {
    claimWork,
  };
}

export type TaskWorkClaimService = ReturnType<typeof createTaskWorkClaimService>;
