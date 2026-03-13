import {
  createMissionControlOrchestrationHistoryStore,
  type MissionControlOrchestrationHistoryStore,
} from './mission-control-orchestration-history-store.ts';
import {
  createMissionControlOrchestrationProjection,
  type MissionControlOrchestrationProjectionEngine,
} from './mission-control-orchestration-projection.ts';

export function createMissionControlOrchestrationInspection(options: {
  projection?: MissionControlOrchestrationProjectionEngine;
  historyStore?: MissionControlOrchestrationHistoryStore;
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
  const projection = options.projection ?? createMissionControlOrchestrationProjection({
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
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionControlOrchestrationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function listInterventionPlans() {
    return projection.listInterventionPlans();
  }

  function inspectInterventionPlan(input: { missionControlInterventionPlanId: string }) {
    return projection.projectOne(input);
  }

  function listStabilizationStrategies() {
    return projection.projectAll().map((entry) => entry.stabilizationStrategy);
  }

  function listOrchestrationActions(input: { missionControlInterventionPlanId: string }) {
    return inspectInterventionPlan(input).actionItems;
  }

  function inspectOrchestrationQueue() {
    return projection.inspectOrchestrationQueue();
  }

  function inspectPriorityPosture(input: { missionControlInterventionPlanId: string }) {
    return inspectInterventionPlan(input).priorityPosture;
  }

  function inspectOrchestrationOutcome(input: { missionControlInterventionPlanId: string }) {
    return inspectInterventionPlan(input).orchestrationOutcome;
  }

  function inspectOrchestrationHistory(input: { missionControlInterventionPlanId: string }) {
    return historyStore.load(input);
  }

  return {
    listInterventionPlans,
    inspectInterventionPlan,
    listStabilizationStrategies,
    listOrchestrationActions,
    inspectOrchestrationQueue,
    inspectPriorityPosture,
    inspectOrchestrationOutcome,
    inspectOrchestrationHistory,
  };
}

export type MissionControlOrchestrationInspection = ReturnType<typeof createMissionControlOrchestrationInspection>;
