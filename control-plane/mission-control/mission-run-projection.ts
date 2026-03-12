import {
  createExecutionAttemptProjection,
  type ExecutionAttemptProjectionEngine,
} from '../execution-attempt/execution-attempt-projection.ts';
import {
  createExecutionEngineProjection,
  type ExecutionEngineProjectionEngine,
} from '../execution-engine/execution-engine-projection.ts';
import {
  createTaskExecutionProjection,
  type TaskExecutionProjectionEngine,
} from '../task-execution/task-execution-projection.ts';
import {
  createTaskOrchestrationProjection,
  type TaskOrchestrationProjectionEngine,
} from '../task-execution/task-orchestration-projection.ts';

import {
  createMissionRunHistoryStore,
  resolveMissionRunArtifactPaths,
  type MissionRunHistoryStore,
} from './mission-run-history-store.ts';
import { deriveMissionCompletionState } from './mission-completion.ts';
import { deriveMissionEscalations } from './mission-escalation.ts';
import { deriveMissionHealthState } from './mission-health.ts';
import { deriveMissionProgress } from './mission-progress.ts';
import { deriveMissionRunId } from './mission-run-identity.ts';
import { deriveMissionRunStatus } from './mission-run-status.ts';
import type { MissionRunProjection } from './mission-run-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function createMissionRunProjection(options: {
  executionAttemptProjection?: ExecutionAttemptProjectionEngine;
  executionEngineProjection?: ExecutionEngineProjectionEngine;
  taskExecutionProjection?: TaskExecutionProjectionEngine;
  taskOrchestrationProjection?: TaskOrchestrationProjectionEngine;
  historyStore?: MissionRunHistoryStore;
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
  missionControlArtifactsRoot?: string;
} = {}) {
  const executionAttemptProjection = options.executionAttemptProjection ?? createExecutionAttemptProjection({
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
  });

  const executionEngineProjection = options.executionEngineProjection ?? createExecutionEngineProjection({
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
  });

  const taskExecutionProjection = options.taskExecutionProjection ?? createTaskExecutionProjection({
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

  const taskOrchestrationProjection = options.taskOrchestrationProjection ?? createTaskOrchestrationProjection({
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionRunHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function projectOne(input: {
    missionRunId?: string;
    executionAttemptId?: string;
  }): MissionRunProjection {
    let executionAttemptId = input.executionAttemptId;

    if (!executionAttemptId && input.missionRunId) {
      const history = historyStore.loadByMissionRunId({ missionRunId: input.missionRunId });
      executionAttemptId = history?.executionAttemptId;
      if (!executionAttemptId) {
        const matchingAttempt = executionAttemptProjection
          .projectAll()
          .find((attemptProjection) => deriveMissionRunId({
            missionId: attemptProjection.missionId,
            executionAttemptId: attemptProjection.executionAttemptId,
            runtimeEnvelopeId: attemptProjection.runtimeEnvelopeId,
            executionContractId: attemptProjection.executionContractId,
          }) === input.missionRunId);
        executionAttemptId = matchingAttempt?.executionAttemptId;
      }
    }

    if (!executionAttemptId) {
      throw new Error('MISSION_RUN_NOT_FOUND');
    }

    const attempt = executionAttemptProjection.projectOne({ executionAttemptId });
    let engine: ReturnType<ExecutionEngineProjectionEngine['projectOne']> | null = null;
    try {
      engine = executionEngineProjection.projectOne({ executionAttemptId: attempt.executionAttemptId });
    } catch {
      engine = null;
    }

    const missionRunId = deriveMissionRunId({
      missionId: attempt.missionId,
      executionAttemptId: attempt.executionAttemptId,
      runtimeEnvelopeId: attempt.runtimeEnvelopeId,
      executionContractId: attempt.executionContractId,
    });

    if (input.missionRunId && input.missionRunId !== missionRunId) {
      throw new Error('MISSION_RUN_NOT_FOUND');
    }

    let taskExecution: ReturnType<TaskExecutionProjectionEngine['projectOne']> | null = null;
    if (engine) {
      try {
        taskExecution = taskExecutionProjection.projectOne({ executionEngineRunId: engine.executionEngineRunId });
      } catch {
        taskExecution = null;
      }
    }

    let orchestration: ReturnType<TaskOrchestrationProjectionEngine['projectOne']> | null = null;
    if (taskExecution && engine) {
      try {
        orchestration = taskOrchestrationProjection.projectOne({
          executionRunId: taskExecution.executionEngineRunId,
          taskGraphId: taskExecution.taskGraphId,
        });
      } catch {
        orchestration = null;
      }
    }

    const progressSummary = deriveMissionProgress({
      taskExecutionProjection: taskExecution,
      taskOrchestrationProjection: orchestration,
    });

    const completionState = deriveMissionCompletionState({
      progressSummary,
      executionEngineState: engine?.engineState,
    });

    const escalations = deriveMissionEscalations({
      missionRunId,
      taskExecutionProjection: taskExecution,
      taskOrchestrationProjection: orchestration,
      executionEngineProjection: engine,
    });

    const healthState = deriveMissionHealthState({
      progressSummary,
      completionState,
      executionEngineEligibilityState: engine?.engineEligibilityState,
      orchestrationCycleState: orchestration?.cycleState,
      escalationCount: escalations.length,
    });

    const runStatus = deriveMissionRunStatus({
      missionRunId,
      missionId: attempt.missionId,
      executionAttemptId: attempt.executionAttemptId,
      runtimeEnvelopeId: attempt.runtimeEnvelopeId,
      executionContractId: attempt.executionContractId,
      executionAttemptLifecycleState: attempt.attemptLifecycleState,
      executionEngineState: engine?.engineState,
      executionEngineEligibilityState: engine?.engineEligibilityState,
      progressSummary,
      completionState,
      healthState,
      escalationCount: escalations.length,
    });

    const blockingReasons = uniqueSorted([
      ...attempt.blockers,
      ...(engine?.blockingReasons ?? []),
      ...(taskExecution?.blockingReasons ?? []),
      ...progressSummary.remainingBlockingNodes.map((nodeId) => `blocking_node:${nodeId}`),
    ]);

    const lastExecutionEventId = ([...(taskExecution?.steps ?? [])]
      .sort((left, right) => {
        const byIndex = left.stepIndex - right.stepIndex;
        if (byIndex !== 0) {
          return byIndex;
        }
        return left.executionStepId.localeCompare(right.executionStepId);
      })
      .at(-1)?.executionStepId) ?? null;

    const artifactPaths = resolveMissionRunArtifactPaths({
      missionRunId,
      rootDir: options.missionControlArtifactsRoot,
    });

    const statusPreview = {
      missionRunId,
      missionId: attempt.missionId,
      executionAttemptId: attempt.executionAttemptId,
      runtimeEnvelopeId: attempt.runtimeEnvelopeId,
      executionContractId: attempt.executionContractId,
      operationalState: runStatus.operationalState,
      completionState,
      healthState,
      reasonTokens: runStatus.reasonTokens,
      escalationCount: escalations.length,
      blockingReasons,
      lastExecutionEventId,
      lastOrchestrationCycleIndex: orchestration?.currentCycleIndex ?? 0,
      executionEngineState: engine?.engineState ?? null,
      executionEngineEligibilityState: engine?.engineEligibilityState ?? null,
    } as Record<string, unknown>;

    const reportPreview = {
      ...statusPreview,
      progressSummary,
      escalations,
      workerLoadSummary: orchestration?.workerLoad ?? [],
    } as Record<string, unknown>;

    return {
      missionRunId,
      missionId: attempt.missionId,
      executionAttemptId: attempt.executionAttemptId,
      runtimeEnvelopeId: attempt.runtimeEnvelopeId,
      executionContractId: attempt.executionContractId,
      operationalState: runStatus.operationalState,
      completionState,
      healthState,
      progressSummary,
      escalations,
      blockingReasons,
      workerLoadSummary: orchestration?.workerLoad ?? [],
      lastExecutionEventId,
      lastOrchestrationCycleIndex: orchestration?.currentCycleIndex ?? 0,
      statusPreview,
      reportPreview,
      artifactPaths,
    };
  }

  function projectAll(): MissionRunProjection[] {
    return executionAttemptProjection
      .projectAll()
      .map((attempt) => projectOne({ executionAttemptId: attempt.executionAttemptId }))
      .sort((left, right) => left.missionRunId.localeCompare(right.missionRunId));
  }

  function summarizeList() {
    return projectAll().map((entry) => ({
      missionRunId: entry.missionRunId,
      missionId: entry.missionId,
      executionAttemptId: entry.executionAttemptId,
      operationalState: entry.operationalState,
      completionState: entry.completionState,
      healthState: entry.healthState,
      completionPercent: entry.progressSummary.completionPercent,
    }));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type MissionRunProjectionEngine = ReturnType<typeof createMissionRunProjection>;
