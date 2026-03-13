import {
  createMissionExecutionActivationHistoryStore,
  type MissionExecutionActivationHistoryStore,
} from './mission-execution-activation-history-store.ts';
import {
  createMissionExecutionActivationProjection,
  type MissionExecutionActivationProjectionEngine,
} from './mission-execution-activation-projection.ts';

export function createMissionExecutionActivationInspection(options: {
  projection?: MissionExecutionActivationProjectionEngine;
  historyStore?: MissionExecutionActivationHistoryStore;
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
  const projection = options.projection ?? createMissionExecutionActivationProjection({
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

  const historyStore = options.historyStore ?? createMissionExecutionActivationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function listActivationRecords() {
    return projection.listActivationRecords();
  }

  function inspectActivationRecord(input: { executionActivationRecordId: string }) {
    return projection.projectOne(input);
  }

  function inspectRequestActivationMappings(input: { executionActivationRecordId: string }) {
    return inspectActivationRecord(input).mapping;
  }

  function inspectActivationEligibility(input: { executionActivationRecordId: string }) {
    return inspectActivationRecord(input).eligibility;
  }

  function inspectActivationQueue(input: { executionActivationRecordId: string }) {
    return inspectActivationRecord(input).queueEntry;
  }

  function inspectActivationFeedbackLinks(input: { executionActivationRecordId: string }) {
    return inspectActivationRecord(input).feedbackLinkSummaries;
  }

  function inspectActivationHistory(input: { executionActivationRecordId: string }) {
    return historyStore.load(input);
  }

  function inspectActivationStatus(input: { executionActivationRecordId: string }) {
    return inspectActivationRecord(input).status;
  }

  function inspectActivationOutcome(input: { executionActivationRecordId: string }) {
    return inspectActivationRecord(input).outcome;
  }

  return {
    listActivationRecords,
    inspectActivationRecord,
    inspectRequestActivationMappings,
    inspectActivationEligibility,
    inspectActivationQueue,
    inspectActivationFeedbackLinks,
    inspectActivationHistory,
    inspectActivationStatus,
    inspectActivationOutcome,
  };
}

export type MissionExecutionActivationInspection = ReturnType<typeof createMissionExecutionActivationInspection>;
