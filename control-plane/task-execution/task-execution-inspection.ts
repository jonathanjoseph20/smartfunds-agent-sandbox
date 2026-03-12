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
import { loadWorkerRegistry, type WorkerRegistry } from '../workers/worker-registry.ts';
import { createTaskWorkClaimService, type TaskWorkClaimService } from './task-work-claim.ts';
import { createTaskWorkerResultHandler, type TaskWorkerResultHandler } from './task-worker-result-handler.ts';
import {
  createTaskOrchestrationInspection,
  type TaskOrchestrationInspection,
} from './task-orchestration-inspection.ts';

export function createTaskExecutionInspection(options: {
  projection?: TaskExecutionProjectionEngine;
  historyStore?: TaskExecutionHistoryStore;
  engine?: TaskExecutionEngine;
  materializer?: TaskExecutionMaterializer;
  workerRegistry?: WorkerRegistry;
  workClaimService?: TaskWorkClaimService;
  workerResultHandler?: TaskWorkerResultHandler;
  orchestrationInspection?: TaskOrchestrationInspection;
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
  const workerRegistry = options.workerRegistry ?? loadWorkerRegistry();
  const workClaimService = options.workClaimService ?? createTaskWorkClaimService({
    projection,
    historyStore,
    taskGraphProjection,
  });
  const workerResultHandler = options.workerResultHandler ?? createTaskWorkerResultHandler({
    projection,
    historyStore,
    taskGraphProjection,
  });
  const orchestrationInspection = options.orchestrationInspection ?? createTaskOrchestrationInspection({
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

  function workersList() {
    return workerRegistry.listWorkers();
  }

  function workersInspect(input: { workerId: string }) {
    return workerRegistry.getWorker(input.workerId);
  }

  function workersStatus() {
    const workers = workerRegistry.listWorkers();
    return {
      totalWorkers: workers.length,
      activeWorkerCount: workers.filter((worker) => worker.status === 'active').length,
      disabledWorkerCount: workers.filter((worker) => worker.status === 'disabled').length,
      workers,
    };
  }

  function taskExecutionClaim(input: {
    taskGraphId: string;
    taskNodeId: string;
    workerId: string;
    claimAttemptIndex?: number;
  }) {
    return workClaimService.claimWork({
      taskGraphId: input.taskGraphId,
      taskNodeId: input.taskNodeId,
      workerId: input.workerId,
      claimAttemptIndex: input.claimAttemptIndex ?? 0,
    });
  }

  function taskExecutionComplete(input: {
    taskGraphId: string;
    taskNodeId: string;
    workerId: string;
    claimId: string;
    attemptIndex: number;
    resultPayload: Record<string, unknown>;
  }) {
    const projected = projection.projectOne({ taskGraphId: input.taskGraphId });
    return workerResultHandler.handleResult({
      taskGraphId: input.taskGraphId,
      executionRunId: projected.executionEngineRunId,
      taskNodeId: input.taskNodeId,
      workerId: input.workerId,
      claimId: input.claimId,
      attemptIndex: input.attemptIndex,
      resultType: 'SUCCESS',
      resultPayload: input.resultPayload,
    });
  }

  function taskExecutionFail(input: {
    taskGraphId: string;
    taskNodeId: string;
    workerId: string;
    claimId: string;
    attemptIndex: number;
    resultType: 'FAILURE' | 'RETRY_REQUESTED';
    resultPayload: Record<string, unknown>;
    failureClass: 'RETRYABLE_FAILURE' | 'NON_RETRYABLE_FAILURE' | 'SYSTEM_FAILURE' | 'POLICY_FAILURE' | 'DEPENDENCY_FAILURE';
    retryEligible: boolean;
  }) {
    const projected = projection.projectOne({ taskGraphId: input.taskGraphId });
    return workerResultHandler.handleResult({
      taskGraphId: input.taskGraphId,
      executionRunId: projected.executionEngineRunId,
      taskNodeId: input.taskNodeId,
      workerId: input.workerId,
      claimId: input.claimId,
      attemptIndex: input.attemptIndex,
      resultType: input.resultType,
      resultPayload: input.resultPayload,
      failureClass: input.failureClass,
      retryEligible: input.retryEligible,
    });
  }

  function taskExecutionWorkerStatus(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    const orchestration = orchestrationInspection.load({
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
    });
    return {
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
      claimedNodeCount: projected.claimedNodeCount,
      activeWorkerCount: projected.activeWorkerCount,
      workerAssignments: projected.workerAssignments,
      workerExecutionState: projected.workerExecutionState,
      workerQueues: orchestration.workerQueues,
    };
  }

  function taskExecutionOrchestrationStatus(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    return orchestrationInspection.orchestrationStatus({
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
    });
  }

  function taskExecutionAssignments(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    return orchestrationInspection.assignments({
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
    });
  }

  function taskExecutionQueues(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    return orchestrationInspection.queues({
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
    });
  }

  function taskExecutionDeferrals(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    return orchestrationInspection.deferrals({
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
    });
  }

  function taskExecutionOrchestrationHistory(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    return orchestrationInspection.history({
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
    });
  }

  function taskExecutionCycle(input: { taskGraphId: string; workerSchedulingPolicyId?: string }) {
    return orchestrationInspection.cycle(input);
  }

  function taskExecutionOrchestrate(input: {
    taskGraphId: string;
    workerSchedulingPolicyId?: string;
    maxCycles?: number;
  }) {
    return orchestrationInspection.orchestrate(input);
  }

  function taskExecutionAssign(input: { taskGraphId: string; workerSchedulingPolicyId?: string }) {
    return orchestrationInspection.assign(input);
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
    workersList,
    workersInspect,
    workersStatus,
    taskExecutionClaim,
    taskExecutionComplete,
    taskExecutionFail,
    taskExecutionWorkerStatus,
    taskExecutionOrchestrationStatus,
    taskExecutionAssignments,
    taskExecutionQueues,
    taskExecutionDeferrals,
    taskExecutionOrchestrationHistory,
    taskExecutionCycle,
    taskExecutionOrchestrate,
    taskExecutionAssign,
  };
}

export type TaskExecutionInspection = ReturnType<typeof createTaskExecutionInspection>;
