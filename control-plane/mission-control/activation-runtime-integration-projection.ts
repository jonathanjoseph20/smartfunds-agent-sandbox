import { deriveActivationAttemptOutcome } from './activation-attempt-outcome.ts';
import { deriveActivationAttemptStatus } from './activation-attempt-status.ts';
import { deriveDispatchAttemptFromActivationProjection, deriveDispatchQueueFromRuntimeIntegration } from './activation-runtime-dispatcher.ts';
import { deriveActivationRuntimeReconciliation } from './activation-runtime-reconciliation.ts';
import { deriveActivationRuntimeLinks, summarizeLinkedExecutionAttemptIds } from './activation-runtime-link.ts';
import {
  createActivationRuntimeIntegrationHistoryStore,
  type ActivationRuntimeIntegrationHistoryStore,
} from './activation-runtime-integration-history-store.ts';
import {
  createMissionExecutionActivationProjection,
  type MissionExecutionActivationProjectionEngine,
} from './mission-execution-activation-projection.ts';
import type {
  ActivationRuntimeIntegrationProjection,
  ActivationRuntimeLink,
  RuntimeFeedbackIngestionRecord,
} from './activation-runtime-integration-types.ts';
import { deriveRuntimeFeedbackIngestionRecords } from './runtime-feedback-ingestion-record.ts';

function runtimeLinksFromHistory(input: {
  activationDispatchAttemptId: string;
  executionActivationRecordId: string;
  historyEntries: ReturnType<ActivationRuntimeIntegrationHistoryStore['replay']>;
}): ActivationRuntimeLink[] {
  return input.historyEntries
    .filter((entry) => entry.eventType === 'activation_runtime_link_created')
    .map((entry) => {
      const payload = entry.payload;
      if (
        typeof payload.activationRuntimeLinkId !== 'string'
        || typeof payload.activationDispatchAttemptId !== 'string'
        || typeof payload.executionActivationRecordId !== 'string'
        || typeof payload.runtimeLinkClass !== 'string'
      ) {
        return null;
      }

      return {
        activationRuntimeLinkId: payload.activationRuntimeLinkId,
        activationDispatchAttemptId: payload.activationDispatchAttemptId,
        executionActivationRecordId: payload.executionActivationRecordId,
        executionAttemptId: typeof payload.executionAttemptId === 'string' ? payload.executionAttemptId : null,
        taskExecutionRunId: typeof payload.taskExecutionRunId === 'string' ? payload.taskExecutionRunId : null,
        workerResultId: typeof payload.workerResultId === 'string' ? payload.workerResultId : null,
        runtimeLinkClass: payload.runtimeLinkClass as ActivationRuntimeLink['runtimeLinkClass'],
        state: 'linked',
      } satisfies ActivationRuntimeLink;
    })
    .filter((entry): entry is ActivationRuntimeLink => entry !== null)
    .sort((left, right) => left.activationRuntimeLinkId.localeCompare(right.activationRuntimeLinkId));
}

function feedbackRecordsFromHistory(input: {
  activationDispatchAttemptId: string;
  historyEntries: ReturnType<ActivationRuntimeIntegrationHistoryStore['replay']>;
}): RuntimeFeedbackIngestionRecord[] {
  return input.historyEntries
    .filter((entry) => entry.eventType === 'runtime_feedback_ingested')
    .map((entry) => {
      const payload = entry.payload;
      if (
        typeof payload.runtimeFeedbackIngestionRecordId !== 'string'
        || typeof payload.activationDispatchAttemptId !== 'string'
        || typeof payload.activationRuntimeLinkId !== 'string'
        || typeof payload.feedbackClass !== 'string'
      ) {
        return null;
      }

      const linkedRuntimeIds = typeof payload.linkedRuntimeIds === 'object' && payload.linkedRuntimeIds !== null
        ? payload.linkedRuntimeIds as Record<string, unknown>
        : {};

      return {
        runtimeFeedbackIngestionRecordId: payload.runtimeFeedbackIngestionRecordId,
        activationDispatchAttemptId: payload.activationDispatchAttemptId,
        activationRuntimeLinkId: payload.activationRuntimeLinkId,
        feedbackClass: payload.feedbackClass as RuntimeFeedbackIngestionRecord['feedbackClass'],
        reasonTokens: Array.isArray(payload.reasonTokens)
          ? payload.reasonTokens.filter((token): token is string => typeof token === 'string').sort((a, b) => a.localeCompare(b))
          : [],
        linkedRuntimeIds: {
          executionAttemptId: typeof linkedRuntimeIds.executionAttemptId === 'string' ? linkedRuntimeIds.executionAttemptId : null,
          taskExecutionRunId: typeof linkedRuntimeIds.taskExecutionRunId === 'string' ? linkedRuntimeIds.taskExecutionRunId : null,
          workerResultId: typeof linkedRuntimeIds.workerResultId === 'string' ? linkedRuntimeIds.workerResultId : null,
        },
        state: 'ingested',
      } satisfies RuntimeFeedbackIngestionRecord;
    })
    .filter((entry): entry is RuntimeFeedbackIngestionRecord => entry !== null)
    .sort((left, right) => left.runtimeFeedbackIngestionRecordId.localeCompare(right.runtimeFeedbackIngestionRecordId));
}

function projectFromActivation(input: {
  activationProjection: ReturnType<MissionExecutionActivationProjectionEngine['projectOne']>;
  historyStore: ActivationRuntimeIntegrationHistoryStore;
  runtimeLinkRecords?: Array<{
    activationDispatchAttemptId?: string;
    executionActivationRecordId?: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    runtimeLinkClass: ActivationRuntimeLink['runtimeLinkClass'];
  }>;
  runtimeFeedbackRecords?: Array<{
    activationDispatchAttemptId?: string;
    executionActivationRecordId?: string;
    activationRuntimeLinkId?: string;
    feedbackClass: string;
    reasonTokens?: string[];
    linkedRuntimeIds?: {
      executionAttemptId?: string | null;
      taskExecutionRunId?: string | null;
      workerResultId?: string | null;
    };
  }>;
}): ActivationRuntimeIntegrationProjection {
  const dispatchAttempt = deriveDispatchAttemptFromActivationProjection({
    activationProjection: input.activationProjection,
  });

  const integrationHistory = input.historyStore.load({
    activationDispatchAttemptId: dispatchAttempt.activationDispatchAttemptId,
  });

  const runtimeLinksFromHistoryReplay = runtimeLinksFromHistory({
    activationDispatchAttemptId: dispatchAttempt.activationDispatchAttemptId,
    executionActivationRecordId: dispatchAttempt.executionActivationRecordId,
    historyEntries: integrationHistory.entries,
  });

  const runtimeLinksFromRuntime = deriveActivationRuntimeLinks({
    dispatchAttempts: [dispatchAttempt],
    linkRecords: input.runtimeLinkRecords,
    feedbackRecords: (input.runtimeFeedbackRecords ?? []).map((entry) => ({
      activationDispatchAttemptId: entry.activationDispatchAttemptId,
      executionActivationRecordId: entry.executionActivationRecordId,
      executionAttemptId: entry.linkedRuntimeIds?.executionAttemptId,
      taskExecutionRunId: entry.linkedRuntimeIds?.taskExecutionRunId,
      workerResultId: entry.linkedRuntimeIds?.workerResultId,
      feedbackClass: entry.feedbackClass,
    })),
  });

  const runtimeLinkSummaries = Array.from(new Map(
    [...runtimeLinksFromHistoryReplay, ...runtimeLinksFromRuntime].map((entry) => [entry.activationRuntimeLinkId, entry])
  ).values()).sort((left, right) => left.activationRuntimeLinkId.localeCompare(right.activationRuntimeLinkId));

  const feedbackFromRuntime = deriveRuntimeFeedbackIngestionRecords({
    dispatchAttempts: [dispatchAttempt],
    feedbackRecords: input.runtimeFeedbackRecords,
  });

  const feedbackFromReplay = feedbackRecordsFromHistory({
    activationDispatchAttemptId: dispatchAttempt.activationDispatchAttemptId,
    historyEntries: integrationHistory.entries,
  });

  const feedbackIngestionSummaries = Array.from(new Map(
    [...feedbackFromRuntime, ...feedbackFromReplay].map((entry) => [entry.runtimeFeedbackIngestionRecordId, entry])
  ).values()).sort((left, right) => left.runtimeFeedbackIngestionRecordId.localeCompare(right.runtimeFeedbackIngestionRecordId));

  const dispatchQueueEntry = deriveDispatchQueueFromRuntimeIntegration({
    dispatchAttempt,
    runtimeLinks: runtimeLinkSummaries,
    feedbackRecords: feedbackIngestionSummaries,
    historyEntries: integrationHistory.entries,
  });

  const status = deriveActivationAttemptStatus({
    activationDispatchAttemptId: dispatchAttempt.activationDispatchAttemptId,
    dispatchQueueEntry,
    feedbackRecords: feedbackIngestionSummaries,
    historyEntries: integrationHistory.entries,
  });

  const outcome = deriveActivationAttemptOutcome({
    activationDispatchAttemptId: dispatchAttempt.activationDispatchAttemptId,
    status,
    feedbackRecords: feedbackIngestionSummaries,
  });

  const derivedReconciliation = deriveActivationRuntimeReconciliation({
    activationDispatchAttemptId: dispatchAttempt.activationDispatchAttemptId,
    feedbackRecords: feedbackIngestionSummaries,
  });

  const reconciliationSummaries = [derivedReconciliation]
    .sort((left, right) => left.activationRuntimeReconciliationId.localeCompare(right.activationRuntimeReconciliationId));

  const linkedExecutionAttemptIds = summarizeLinkedExecutionAttemptIds(runtimeLinkSummaries);

  const statusPreview = {
    activationDispatchAttemptId: dispatchAttempt.activationDispatchAttemptId,
    executionActivationRecordId: dispatchAttempt.executionActivationRecordId,
    dispatchQueueState: dispatchQueueEntry.queueState,
    status: status.status,
    outcome: outcome.outcome,
  } as Record<string, unknown>;

  const reportPreview = {
    dispatchAttempt,
    dispatchQueueEntry,
    runtimeLinkSummaries,
    feedbackIngestionSummaries,
    reconciliationSummaries,
    integrationHistory,
    status,
    outcome,
  } as Record<string, unknown>;

  return {
    activationDispatchAttemptId: dispatchAttempt.activationDispatchAttemptId,
    executionActivationRecordId: dispatchAttempt.executionActivationRecordId,
    dispatchQueueState: dispatchQueueEntry.queueState,
    runtimeLinkSummaries,
    feedbackIngestionSummaries,
    reconciliationSummaries,
    status,
    outcome,
    priority: dispatchAttempt.priority,
    linkedExecutionAttemptIds,
    integrationHistory,
    dispatchAttempt,
    dispatchQueueEntry,
    statusPreview,
    reportPreview,
  } satisfies ActivationRuntimeIntegrationProjection;
}

export function createActivationRuntimeIntegrationProjection(options: {
  activationProjection?: MissionExecutionActivationProjectionEngine;
  historyStore?: ActivationRuntimeIntegrationHistoryStore;
  runtimeLinkRecords?: Array<{
    activationDispatchAttemptId?: string;
    executionActivationRecordId?: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    runtimeLinkClass: ActivationRuntimeLink['runtimeLinkClass'];
  }>;
  runtimeFeedbackRecords?: Array<{
    activationDispatchAttemptId?: string;
    executionActivationRecordId?: string;
    activationRuntimeLinkId?: string;
    feedbackClass: string;
    reasonTokens?: string[];
    linkedRuntimeIds?: {
      executionAttemptId?: string | null;
      taskExecutionRunId?: string | null;
      workerResultId?: string | null;
    };
  }>;
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
  const activationProjection = options.activationProjection ?? createMissionExecutionActivationProjection({
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

  function projectAll(): ActivationRuntimeIntegrationProjection[] {
    const byId = new Map<string, ActivationRuntimeIntegrationProjection>();

    for (const activation of activationProjection.projectAll()) {
      const projection = projectFromActivation({
        activationProjection: activation,
        historyStore,
        runtimeLinkRecords: options.runtimeLinkRecords,
        runtimeFeedbackRecords: options.runtimeFeedbackRecords,
      });
      byId.set(projection.activationDispatchAttemptId, projection);
    }

    return Array.from(byId.values())
      .sort((left, right) => left.activationDispatchAttemptId.localeCompare(right.activationDispatchAttemptId));
  }

  function projectOne(input: { activationDispatchAttemptId: string }): ActivationRuntimeIntegrationProjection {
    const found = projectAll().find((entry) => entry.activationDispatchAttemptId === input.activationDispatchAttemptId);
    if (!found) {
      throw new Error('ACTIVATION_DISPATCH_ATTEMPT_NOT_FOUND');
    }
    return found;
  }

  function listDispatchAttempts() {
    return projectAll().map((entry) => ({
      activationDispatchAttemptId: entry.activationDispatchAttemptId,
      executionActivationRecordId: entry.executionActivationRecordId,
      priority: entry.priority,
      dispatchQueueState: entry.dispatchQueueState,
      status: entry.status.status,
      outcome: entry.outcome.outcome,
    }));
  }

  function listDispatchQueue() {
    return projectAll()
      .map((entry) => entry.dispatchQueueEntry)
      .sort((left, right) => left.activationDispatchQueueEntryId.localeCompare(right.activationDispatchQueueEntryId));
  }

  return {
    projectAll,
    projectOne,
    listDispatchAttempts,
    listDispatchQueue,
  };
}

export type ActivationRuntimeIntegrationProjectionEngine = ReturnType<typeof createActivationRuntimeIntegrationProjection>;
