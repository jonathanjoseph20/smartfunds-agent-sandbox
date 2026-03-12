import {
  createTaskExecutionEngine,
  type TaskExecutionEngine,
} from './task-execution-engine.ts';
import {
  createTaskExecutionHistoryStore,
  type TaskExecutionHistoryStore,
} from './task-execution-history-store.ts';
import {
  createTaskExecutionMaterializer,
  type TaskExecutionMaterializer,
} from './task-execution-materializer.ts';
import {
  createTaskExecutionProjection,
  type TaskExecutionProjectionEngine,
} from './task-execution-projection.ts';
import {
  DEFAULT_TASK_CONCURRENCY_POLICY_ID,
  getTaskConcurrencyPolicy,
} from './task-concurrency-policies.ts';
import { evaluateRunnableNodeSet } from './task-runnable-node-set.ts';
import { computeSchedulingWave } from './task-concurrency-scheduler.ts';
import { createTaskGraphProjection } from '../task-graph/task-graph-projection.ts';

export function createTaskExecutionInspection(options: {
  projection?: TaskExecutionProjectionEngine;
  historyStore?: TaskExecutionHistoryStore;
  engine?: TaskExecutionEngine;
  materializer?: TaskExecutionMaterializer;
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

  const projection = options.projection ?? createTaskExecutionProjection({
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

  const engine = options.engine ?? createTaskExecutionEngine({
    projection,
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

  const materializer = options.materializer ?? createTaskExecutionMaterializer({
    projection,
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

  const taskGraphProjection = createTaskGraphProjection({
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

  function listTaskExecutionRuns() {
    return projection.summarizeList();
  }

  function inspectTaskExecutionRun(input: { taskGraphId: string }) {
    return projection.projectOne(input);
  }

  function taskExecutionStatus(input: { taskGraphId: string }) {
    return projection.projectOne(input).statusPreview;
  }

  function taskExecutionHistory(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    return historyStore.load({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
    });
  }

  function stepTaskExecution(input: { taskGraphId: string }) {
    return engine.step(input);
  }

  function failTaskNode(input: {
    taskGraphId: string;
    taskNodeId: string;
    failureCode?: string;
    failureClass?: 'RETRYABLE_FAILURE' | 'NON_RETRYABLE_FAILURE' | 'SYSTEM_FAILURE' | 'POLICY_FAILURE' | 'DEPENDENCY_FAILURE';
  }) {
    return engine.failNode(input);
  }

  function retryTaskNode(input: { taskGraphId: string; taskNodeId: string }) {
    return engine.retryNode(input);
  }

  function retryTaskExecutionStatus(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    return {
      taskGraphId: projected.taskGraphId,
      graphState: projected.graphState,
      graphFailureState: projected.graphFailureState,
      retryAttempts: projected.retryAttempts,
      retryLimitBreaches: projected.retryLimitBreaches,
      retryingNodeCount: projected.retryingNodeCount,
      failedNodeCount: projected.failedNodeCount,
      blockedNodeCount: projected.blockedNodeCount,
    };
  }

  function retryTaskExecutionHistory(input: { taskGraphId: string }) {
    const history = taskExecutionHistory(input);
    return {
      ...history,
      entries: history.entries.filter((entry) => (
        entry.eventType === 'node_retry_scheduled'
        || entry.eventType === 'node_retry_started'
        || entry.eventType === 'node_retry_exhausted'
      )),
    };
  }

  function advanceTaskExecution(input: { taskGraphId: string }) {
    return engine.advance(input);
  }

  function simulateTaskExecution(input: { taskGraphId: string }) {
    return engine.simulate(input);
  }

  function materializeTaskExecution(input: { taskGraphId: string }) {
    return materializer.materializeOne(input);
  }

  function taskExecutionRunnable(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    const taskGraph = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId });
    const history = historyStore.load({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
    });
    const policy = getTaskConcurrencyPolicy(DEFAULT_TASK_CONCURRENCY_POLICY_ID);

    return evaluateRunnableNodeSet(taskGraph, projected, history, policy);
  }

  function taskExecutionConcurrencyStatus(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    return {
      taskGraphId: projected.taskGraphId,
      policyId: projected.concurrencyPolicyId,
      maxConcurrentNodes: projected.maxConcurrentNodes,
      runnableNodeCount: projected.runnableNodeCount,
      scheduledNodeCount: projected.scheduledNodeCount,
      deferredNodeCount: projected.deferredNodeCount,
      activeSlots: projected.activeConcurrencySlots,
      availableSlots: projected.availableConcurrencySlots,
      currentWaveIndex: projected.currentWaveIndex,
      schedulingState: projected.schedulingState,
    };
  }

  function scheduleTaskExecutionWave(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    const runnableSet = taskExecutionRunnable(input);
    const policy = getTaskConcurrencyPolicy(DEFAULT_TASK_CONCURRENCY_POLICY_ID);
    const wave = computeSchedulingWave(runnableSet, policy, projected);

    return {
      waveIndex: wave.waveIndex,
      scheduledNodes: wave.scheduledNodeIds,
      deferredNodes: wave.deferredNodeIds,
    };
  }

  function taskExecutionConcurrencyHistory(input: { taskGraphId: string }) {
    const history = taskExecutionHistory(input);

    return {
      ...history,
      entries: history.entries.filter((entry) => (
        entry.eventType === 'concurrency_wave_evaluated'
        || entry.eventType === 'concurrency_slots_allocated'
        || entry.eventType === 'node_scheduled_for_execution'
        || entry.eventType === 'node_deferred_by_concurrency_limit'
        || entry.eventType === 'concurrency_wave_completed'
      )),
    };
  }

  return {
    listTaskExecutionRuns,
    inspectTaskExecutionRun,
    taskExecutionStatus,
    taskExecutionHistory,
    stepTaskExecution,
    failTaskNode,
    retryTaskNode,
    retryTaskExecutionStatus,
    retryTaskExecutionHistory,
    advanceTaskExecution,
    simulateTaskExecution,
    materializeTaskExecution,
    taskExecutionRunnable,
    taskExecutionConcurrencyStatus,
    scheduleTaskExecutionWave,
    taskExecutionConcurrencyHistory,
  };
}

export type TaskExecutionInspection = ReturnType<typeof createTaskExecutionInspection>;
