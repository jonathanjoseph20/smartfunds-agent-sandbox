import {
  createActivationRuntimeIntegrationHistoryStore,
  type ActivationRuntimeIntegrationHistoryStore,
} from './activation-runtime-integration-history-store.ts';
import {
  createActivationRuntimeIntegrationProjection,
  type ActivationRuntimeIntegrationProjectionEngine,
} from './activation-runtime-integration-projection.ts';

export function createActivationRuntimeIntegrationInspection(options: {
  projection?: ActivationRuntimeIntegrationProjectionEngine;
  historyStore?: ActivationRuntimeIntegrationHistoryStore;
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
  const projection = options.projection ?? createActivationRuntimeIntegrationProjection({
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

  const historyStore = options.historyStore ?? createActivationRuntimeIntegrationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function listDispatchAttempts() {
    return projection.listDispatchAttempts();
  }

  function inspectDispatchAttempt(input: { activationDispatchAttemptId: string }) {
    return projection.projectOne(input);
  }

  function inspectDispatchQueue(input: { activationDispatchAttemptId: string }) {
    return inspectDispatchAttempt(input).dispatchQueueEntry;
  }

  function inspectRuntimeLinks(input: { activationDispatchAttemptId: string }) {
    return inspectDispatchAttempt(input).runtimeLinkSummaries;
  }

  function inspectFeedbackRecords(input: { activationDispatchAttemptId: string }) {
    return inspectDispatchAttempt(input).feedbackIngestionSummaries;
  }

  function inspectReconciliation(input: { activationDispatchAttemptId: string }) {
    return inspectDispatchAttempt(input).reconciliationSummaries;
  }

  function inspectIntegrationHistory(input: { activationDispatchAttemptId: string }) {
    return historyStore.load(input);
  }

  function inspectAttemptOutcome(input: { activationDispatchAttemptId: string }) {
    return inspectDispatchAttempt(input).outcome;
  }

  return {
    listDispatchAttempts,
    inspectDispatchAttempt,
    inspectDispatchQueue,
    inspectRuntimeLinks,
    inspectFeedbackRecords,
    inspectReconciliation,
    inspectIntegrationHistory,
    inspectAttemptOutcome,
  };
}

export type ActivationRuntimeIntegrationInspection = ReturnType<typeof createActivationRuntimeIntegrationInspection>;
