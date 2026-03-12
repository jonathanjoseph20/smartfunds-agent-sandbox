import { createTaskExecutionProjection, type TaskExecutionProjectionEngine } from './task-execution-projection.ts';
import { getWorkerSchedulingPolicy, DEFAULT_WORKER_SCHEDULING_POLICY_ID } from './task-assignment-decision.ts';
import { scheduleWorkerAssignments } from './task-worker-scheduler.ts';
import {
  createTaskOrchestrationHistoryStore,
  type TaskOrchestrationHistoryStore,
} from './task-orchestration-history-store.ts';
import {
  createTaskOrchestrationProjection,
  type TaskOrchestrationProjectionEngine,
} from './task-orchestration-projection.ts';
import { deriveOrchestrationCycleId } from './task-orchestration-identity.ts';
import { loadWorkerRegistry, type WorkerRegistry } from '../workers/worker-registry.ts';
import { createTaskGraphProjection, type TaskGraphProjectionEngine } from '../task-graph/task-graph-projection.ts';

export function createTaskExecutionOrchestrator(options: {
  projection?: TaskExecutionProjectionEngine;
  orchestrationHistoryStore?: TaskOrchestrationHistoryStore;
  orchestrationProjection?: TaskOrchestrationProjectionEngine;
  workerRegistry?: WorkerRegistry;
  taskGraphProjection?: TaskGraphProjectionEngine;
  taskExecutionArtifactsRoot?: string;
  workerDefinitionsDir?: string;
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
} = {}) {
  const projection = options.projection ?? createTaskExecutionProjection({
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

  const orchestrationHistoryStore = options.orchestrationHistoryStore ?? createTaskOrchestrationHistoryStore({
    artifactsRoot: options.taskExecutionArtifactsRoot,
  });

  const workerRegistry = options.workerRegistry ?? loadWorkerRegistry({
    definitionsDir: options.workerDefinitionsDir,
  });

  const orchestrationProjection = options.orchestrationProjection ?? createTaskOrchestrationProjection({
    historyStore: orchestrationHistoryStore,
    workerRegistry,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
    workerDefinitionsDir: options.workerDefinitionsDir,
  });

  function cycle(input: {
    taskGraphId: string;
    workerSchedulingPolicyId?: string;
  }) {
    const policy = getWorkerSchedulingPolicy(input.workerSchedulingPolicyId ?? DEFAULT_WORKER_SCHEDULING_POLICY_ID);
    const taskExecution = projection.projectOne({ taskGraphId: input.taskGraphId });
    const taskGraph = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId });
    const orchestrationBefore = orchestrationProjection.projectOne({
      executionRunId: taskExecution.executionEngineRunId,
      taskGraphId: taskExecution.taskGraphId,
    });

    const cycleIndex = orchestrationBefore.currentCycleIndex + 1;
    const runnableNodeIds = [...taskExecution.currentWaveNodeIds, ...taskExecution.deferredNodeIds]
      .sort((left, right) => left.localeCompare(right));

    const eligibleWorkerIds = workerRegistry
      .listWorkers()
      .filter((worker) => worker.status !== 'disabled')
      .map((worker) => worker.workerId)
      .sort((left, right) => left.localeCompare(right));

    const orchestrationCycleId = deriveOrchestrationCycleId({
      executionRunId: taskExecution.executionEngineRunId,
      taskGraphId: taskExecution.taskGraphId,
      cycleIndex,
      workerSchedulingPolicyId: policy.policyId,
      runnableNodeIds,
      eligibleWorkerIds,
    });

    const cycleSeed = {
      orchestrationCycleId,
      executionRunId: taskExecution.executionEngineRunId,
      taskGraphId: taskExecution.taskGraphId,
      cycleIndex,
      workerSchedulingPolicyId: policy.policyId,
      runnableNodeIds,
      eligibleWorkerIds,
      assignmentDecisionIds: [] as string[],
      deferredNodeIds: [] as string[],
      completedAssignmentCount: 0,
      queueUpdates: 0,
      cycleState: 'evaluating' as const,
    };

    orchestrationHistoryStore.append({
      executionRunId: taskExecution.executionEngineRunId,
      taskGraphId: taskExecution.taskGraphId,
      eventType: 'orchestration_cycle_started',
      eventPayload: {
        cycle: cycleSeed,
      },
    });

    const currentAssignedByWorker = Object.fromEntries(
      orchestrationBefore.workerQueues
        .map((workerQueue) => [workerQueue.workerId, workerQueue.currentAssignedCount])
        .sort(([left], [right]) => left.localeCompare(right)),
    ) as Record<string, number>;

    const retryAttemptByNode = Object.fromEntries(
      taskExecution.retryAttempts
        .map((retryAttempt) => [retryAttempt.taskNodeId, retryAttempt.attemptIndex])
        .sort(([left], [right]) => left.localeCompare(right)),
    ) as Record<string, number>;

    const decisions = scheduleWorkerAssignments({
      executionRunId: taskExecution.executionEngineRunId,
      taskGraphId: taskExecution.taskGraphId,
      cycleIndex,
      policy,
      runnableNodeIds,
      taskNodes: taskGraph.taskNodes,
      taskEdges: taskGraph.taskEdges,
      workers: workerRegistry.listWorkers(),
      retryAttemptByNode,
      currentAssignedByWorker,
    });

    for (const decision of decisions) {
      orchestrationHistoryStore.append({
        executionRunId: taskExecution.executionEngineRunId,
        taskGraphId: taskExecution.taskGraphId,
        eventType: 'worker_assignment_evaluated',
        eventPayload: {
          assignmentDecision: decision,
        },
      });

      if (decision.assignmentState === 'assigned' && decision.workerId) {
        orchestrationHistoryStore.append({
          executionRunId: taskExecution.executionEngineRunId,
          taskGraphId: taskExecution.taskGraphId,
          eventType: 'worker_assignment_created',
          eventPayload: {
            assignmentDecision: decision,
            assignmentDecisionId: decision.assignmentDecisionId,
            workerId: decision.workerId,
            taskNodeId: decision.taskNodeId,
          },
        });

        orchestrationHistoryStore.append({
          executionRunId: taskExecution.executionEngineRunId,
          taskGraphId: taskExecution.taskGraphId,
          eventType: 'worker_queue_updated',
          eventPayload: {
            queueAction: 'enqueued',
            assignmentDecisionId: decision.assignmentDecisionId,
            workerId: decision.workerId,
            taskNodeId: decision.taskNodeId,
          },
        });
      } else {
        orchestrationHistoryStore.append({
          executionRunId: taskExecution.executionEngineRunId,
          taskGraphId: taskExecution.taskGraphId,
          eventType: 'worker_assignment_deferred',
          eventPayload: {
            assignmentDecision: decision,
            taskNodeId: decision.taskNodeId,
            reasonTokens: decision.deferralReasonTokens,
          },
        });
      }
    }

    const assigned = decisions.filter((decision) => decision.assignmentState === 'assigned');
    const deferred = decisions.filter((decision) => decision.assignmentState !== 'assigned');

    const cycleCompleted = {
      ...cycleSeed,
      assignmentDecisionIds: decisions.map((decision) => decision.assignmentDecisionId).sort((left, right) => left.localeCompare(right)),
      deferredNodeIds: deferred.map((decision) => decision.taskNodeId).sort((left, right) => left.localeCompare(right)),
      completedAssignmentCount: assigned.length,
      queueUpdates: assigned.length,
      cycleState: assigned.length > 0
        ? 'assigning'
        : taskExecution.runningNodeCount > 0
          ? 'waiting_on_results'
          : runnableNodeIds.length === 0
            ? 'blocked'
            : 'incomplete',
    };

    orchestrationHistoryStore.append({
      executionRunId: taskExecution.executionEngineRunId,
      taskGraphId: taskExecution.taskGraphId,
      eventType: 'orchestration_cycle_completed',
      eventPayload: {
        cycle: cycleCompleted,
      },
    });

    return {
      cycle: cycleCompleted,
      assignments: decisions,
      orchestration: orchestrationProjection.projectOne({
        executionRunId: taskExecution.executionEngineRunId,
        taskGraphId: taskExecution.taskGraphId,
      }),
    };
  }

  function orchestrate(input: {
    taskGraphId: string;
    workerSchedulingPolicyId?: string;
    maxCycles?: number;
  }) {
    const maxCycles = Number.isInteger(input.maxCycles) && (input.maxCycles ?? 0) > 0
      ? (input.maxCycles as number)
      : 1;

    const cycles = [] as Array<ReturnType<typeof cycle>>;
    for (let index = 0; index < maxCycles; index += 1) {
      const cycleResult = cycle({
        taskGraphId: input.taskGraphId,
        workerSchedulingPolicyId: input.workerSchedulingPolicyId,
      });
      cycles.push(cycleResult);

      if (cycleResult.cycle.cycleState === 'blocked' || cycleResult.cycle.cycleState === 'waiting_on_results') {
        break;
      }
    }

    const projected = projection.projectOne({ taskGraphId: input.taskGraphId });

    return {
      cycleCount: cycles.length,
      cycles: cycles.map((entry) => entry.cycle),
      lastOrchestrationState: cycles.length > 0
        ? cycles[cycles.length - 1]!.orchestration
        : orchestrationProjection.projectOne({
          executionRunId: projected.executionEngineRunId,
          taskGraphId: projected.taskGraphId,
        }),
    };
  }

  function assign(input: {
    taskGraphId: string;
    workerSchedulingPolicyId?: string;
  }) {
    const cycleResult = cycle(input);

    return {
      cycle: cycleResult.cycle,
      assignments: cycleResult.assignments,
    };
  }

  return {
    cycle,
    orchestrate,
    assign,
  };
}

export type TaskExecutionOrchestrator = ReturnType<typeof createTaskExecutionOrchestrator>;
