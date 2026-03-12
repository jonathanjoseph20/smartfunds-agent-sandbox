import {
  createExecutionAttemptProjection,
  type ExecutionAttemptProjectionEngine,
} from '../execution-attempt/execution-attempt-projection.ts';

import {
  createExecutionJournalHistoryStore,
  type ExecutionJournalHistoryStore,
} from './execution-journal-history-store.ts';
import {
  createExecutionJournalMaterializer,
  type ExecutionJournalMaterializer,
} from './execution-journal-materializer.ts';
import {
  createExecutionJournalProjection,
  deriveExecutionJournalId,
  type ExecutionJournalProjectionEngine,
} from './execution-journal-projection.ts';
import type { ExecutionJournalEventType } from './execution-journal-types.ts';

function appendAttemptLifecycleEvents(input: {
  historyStore: ExecutionJournalHistoryStore;
  executionJournalId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  attemptIndex: number;
  attemptState: string;
  attemptLifecycleState: string;
  blockers: string[];
  limitations: string[];
}): void {
  const append = (eventType: ExecutionJournalEventType, payload: Record<string, unknown>, reasonTokens: string[]): void => {
    input.historyStore.append({
      executionJournalId: input.executionJournalId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventType,
      eventPayload: payload,
      reasonTokens,
      blockingReasons: input.blockers,
      limitations: input.limitations,
    });
  };

  append('attempt_created', {
    executionJournalId: input.executionJournalId,
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    attemptIndex: input.attemptIndex,
    attemptState: input.attemptState,
    attemptLifecycleState: input.attemptLifecycleState,
  }, ['attempt_projection_available']);

  if (input.attemptLifecycleState === 'prepared' || input.attemptLifecycleState === 'ready_for_execution') {
    append('attempt_prepared', {
      executionJournalId: input.executionJournalId,
      executionAttemptId: input.executionAttemptId,
      attemptLifecycleState: input.attemptLifecycleState,
      attemptState: input.attemptState,
    }, ['attempt_prepared_from_projection']);
  }

  if (input.attemptLifecycleState === 'ready_for_execution') {
    append('attempt_ready_for_execution', {
      executionJournalId: input.executionJournalId,
      executionAttemptId: input.executionAttemptId,
      attemptLifecycleState: input.attemptLifecycleState,
      attemptState: input.attemptState,
    }, ['attempt_ready_for_execution_from_projection']);
  }

  if (input.attemptLifecycleState === 'cancelled') {
    append('attempt_cancelled', {
      executionJournalId: input.executionJournalId,
      executionAttemptId: input.executionAttemptId,
      attemptLifecycleState: input.attemptLifecycleState,
      attemptState: input.attemptState,
    }, ['attempt_cancelled_from_projection']);
  }
}

export function createExecutionJournalInspection(options: {
  executionAttemptProjection?: ExecutionAttemptProjectionEngine;
  projection?: ExecutionJournalProjectionEngine;
  historyStore?: ExecutionJournalHistoryStore;
  materializer?: ExecutionJournalMaterializer;
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

  const historyStore = options.historyStore ?? createExecutionJournalHistoryStore({
    artifactsRoot: options.executionJournalArtifactsRoot,
  });

  const projection = options.projection ?? createExecutionJournalProjection({
    executionAttemptProjection,
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
  });

  const materializer = options.materializer ?? createExecutionJournalMaterializer({
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
  });

  function evaluateExecutionJournal(input: { executionAttemptId: string }) {
    const attempt = executionAttemptProjection.projectOne({ executionAttemptId: input.executionAttemptId });

    const executionJournalId = deriveExecutionJournalId({
      executionAttemptId: attempt.executionAttemptId,
      runtimeEnvelopeId: attempt.runtimeEnvelopeId,
      executionContractId: attempt.executionContractId,
      missionId: attempt.missionId,
    });

    appendAttemptLifecycleEvents({
      historyStore,
      executionJournalId,
      executionAttemptId: attempt.executionAttemptId,
      runtimeEnvelopeId: attempt.runtimeEnvelopeId,
      executionContractId: attempt.executionContractId,
      missionId: attempt.missionId,
      attemptIndex: attempt.attemptIndex,
      attemptState: attempt.attemptState,
      attemptLifecycleState: attempt.attemptLifecycleState,
      blockers: attempt.blockers,
      limitations: attempt.limitations,
    });

    return projection.projectOne({ executionAttemptId: input.executionAttemptId });
  }

  function listExecutionJournals() {
    return projection.summarizeList();
  }

  function inspectExecutionJournal(input: { executionAttemptId: string }) {
    return projection.projectOne(input);
  }

  function getExecutionJournalStatus(input: { executionAttemptId: string }) {
    return projection.projectOne(input).statusPreview;
  }

  function getExecutionJournalHistory(input: { executionAttemptId: string }) {
    const projected = projection.projectOne(input);
    return historyStore.load({
      executionJournalId: projected.executionJournalId,
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
    });
  }

  function materializeExecutionJournal(input: { executionAttemptId: string }) {
    evaluateExecutionJournal(input);
    return materializer.materializeOne(input);
  }

  return {
    listExecutionJournals,
    inspectExecutionJournal,
    getExecutionJournalStatus,
    getExecutionJournalHistory,
    evaluateExecutionJournal,
    materializeExecutionJournal,
  };
}

export type ExecutionJournalInspection = ReturnType<typeof createExecutionJournalInspection>;
