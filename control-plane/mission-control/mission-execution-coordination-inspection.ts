import {
  createMissionExecutionCoordinationHistoryStore,
  type MissionExecutionCoordinationHistoryStore,
} from './mission-execution-coordination-history-store.ts';
import {
  createMissionExecutionCoordinationProjection,
  type MissionExecutionCoordinationProjectionEngine,
} from './mission-execution-coordination-projection.ts';

export function createMissionExecutionCoordinationInspection(options: {
  projection?: MissionExecutionCoordinationProjectionEngine;
  historyStore?: MissionExecutionCoordinationHistoryStore;
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
  const projection = options.projection ?? createMissionExecutionCoordinationProjection({
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

  const historyStore = options.historyStore ?? createMissionExecutionCoordinationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function listExecutionCoordinationPlans() {
    return projection.listExecutionCoordinationPlans();
  }

  function inspectExecutionCoordinationPlan(input: { missionExecutionCoordinationPlanId: string }) {
    return projection.projectOne(input);
  }

  function inspectExecutionIntents(input: { missionExecutionCoordinationPlanId: string }) {
    return inspectExecutionCoordinationPlan(input).executionIntentSummaries;
  }

  function inspectExecutionRequests(input: { missionExecutionCoordinationPlanId: string }) {
    return inspectExecutionCoordinationPlan(input).executionRequestSummaries;
  }

  function inspectExecutionFeedbackLinks(input: { missionExecutionCoordinationPlanId: string }) {
    return inspectExecutionCoordinationPlan(input).feedbackLinkSummaries;
  }

  function inspectExecutionStatus(input: { missionExecutionCoordinationPlanId: string }) {
    return inspectExecutionCoordinationPlan(input).status;
  }

  function inspectExecutionOutcome(input: { missionExecutionCoordinationPlanId: string }) {
    return inspectExecutionCoordinationPlan(input).outcome;
  }

  function inspectExecutionHistory(input: { missionExecutionCoordinationPlanId: string }) {
    return historyStore.load(input);
  }

  return {
    listExecutionCoordinationPlans,
    inspectExecutionCoordinationPlan,
    inspectExecutionIntents,
    inspectExecutionRequests,
    inspectExecutionFeedbackLinks,
    inspectExecutionStatus,
    inspectExecutionOutcome,
    inspectExecutionHistory,
  };
}

export type MissionExecutionCoordinationInspection = ReturnType<typeof createMissionExecutionCoordinationInspection>;
