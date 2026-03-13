import {
  createRuntimeOutcomePropagationHistoryStore,
  type RuntimeOutcomePropagationHistoryStore,
} from './runtime-outcome-propagation-history-store.ts';
import {
  createRuntimeOutcomePropagationProjection,
  type RuntimeOutcomePropagationProjectionEngine,
} from './runtime-outcome-propagation-projection.ts';

export function createRuntimeOutcomePropagationInspection(options: {
  projection?: RuntimeOutcomePropagationProjectionEngine;
  historyStore?: RuntimeOutcomePropagationHistoryStore;
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
  const projection = options.projection ?? createRuntimeOutcomePropagationProjection({
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

  const historyStore = options.historyStore ?? createRuntimeOutcomePropagationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function listPropagationRecords() {
    return projection.listPropagationRecords();
  }

  function inspectPropagationRecord(input: { runtimeOutcomePropagationRecordId: string }) {
    return projection.projectOne(input);
  }

  function inspectActivationPropagation(input: { runtimeOutcomePropagationRecordId: string }) {
    return inspectPropagationRecord(input).activationPropagationSummaries;
  }

  function inspectCoordinationPropagation(input: { runtimeOutcomePropagationRecordId: string }) {
    return inspectPropagationRecord(input).executionCoordinationPropagationSummaries;
  }

  function inspectOrchestrationPropagation(input: { runtimeOutcomePropagationRecordId: string }) {
    return inspectPropagationRecord(input).missionOrchestrationPropagationSummaries;
  }

  function inspectPortfolioPropagation(input: { runtimeOutcomePropagationRecordId: string }) {
    return inspectPropagationRecord(input).missionPortfolioPropagationSummaries;
  }

  function inspectPropagationHistory(input: { runtimeOutcomePropagationRecordId: string }) {
    return historyStore.load(input);
  }

  function inspectPropagationOutcome(input: { runtimeOutcomePropagationRecordId: string }) {
    const record = inspectPropagationRecord(input);
    return {
      runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
      status: record.status,
      outcome: record.outcome,
    };
  }

  return {
    listPropagationRecords,
    inspectPropagationRecord,
    inspectActivationPropagation,
    inspectCoordinationPropagation,
    inspectOrchestrationPropagation,
    inspectPortfolioPropagation,
    inspectPropagationHistory,
    inspectPropagationOutcome,
  };
}

export type RuntimeOutcomePropagationInspection = ReturnType<typeof createRuntimeOutcomePropagationInspection>;
