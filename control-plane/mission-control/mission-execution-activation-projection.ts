import { createExecutionActivationRecord, sortExecutionActivationRecords } from './execution-activation-record.ts';
import { deriveExecutionActivationEligibility, type RuntimeCapabilitySurface } from './execution-activation-eligibility.ts';
import { deriveExecutionActivationFeedbackLinks, summarizeLinkedExecutionAttemptIds } from './execution-activation-feedback-link.ts';
import { deriveExecutionActivationOutcome } from './execution-activation-outcome.ts';
import { deriveExecutionActivationStatus } from './execution-activation-status.ts';
import { deriveExecutionRequestActivationMappings } from './execution-request-activation-mapping.ts';
import {
  createMissionExecutionActivationHistoryStore,
  type MissionExecutionActivationHistoryStore,
} from './mission-execution-activation-history-store.ts';
import { deriveMissionExecutionActivationQueueEntry, sortMissionExecutionActivationQueue } from './mission-execution-activation-queue.ts';
import {
  createMissionExecutionCoordinationProjection,
  type MissionExecutionCoordinationProjectionEngine,
} from './mission-execution-coordination-projection.ts';
import type {
  ExecutionActivationFeedbackClass,
  ExecutionActivationFeedbackLink,
  MissionExecutionActivationProjection,
} from './mission-execution-activation-types.ts';

function feedbackLinksFromHistory(input: {
  executionActivationRecordId: string;
  executionRequestRecordId: string;
  historyEntries: ReturnType<MissionExecutionActivationHistoryStore['replay']>;
}): ExecutionActivationFeedbackLink[] {
  return input.historyEntries
    .filter((entry) => entry.eventType === 'execution_activation_feedback_linked')
    .map((entry) => {
      const payload = entry.payload;
      if (
        typeof payload.executionActivationFeedbackLinkId !== 'string'
        || typeof payload.executionActivationRecordId !== 'string'
        || typeof payload.executionRequestRecordId !== 'string'
        || typeof payload.feedbackClass !== 'string'
      ) {
        return null;
      }

      return {
        executionActivationFeedbackLinkId: payload.executionActivationFeedbackLinkId,
        executionActivationRecordId: payload.executionActivationRecordId,
        executionRequestRecordId: payload.executionRequestRecordId,
        executionAttemptId: typeof payload.executionAttemptId === 'string' ? payload.executionAttemptId : null,
        taskExecutionRunId: typeof payload.taskExecutionRunId === 'string' ? payload.taskExecutionRunId : null,
        workerResultId: typeof payload.workerResultId === 'string' ? payload.workerResultId : null,
        feedbackClass: payload.feedbackClass as ExecutionActivationFeedbackClass,
        state: 'linked',
      } satisfies ExecutionActivationFeedbackLink;
    })
    .filter((entry): entry is ExecutionActivationFeedbackLink => entry !== null)
    .sort((left, right) => left.executionActivationFeedbackLinkId.localeCompare(right.executionActivationFeedbackLinkId));
}

function projectFromCoordination(input: {
  coordination: ReturnType<MissionExecutionCoordinationProjectionEngine['projectOne']>;
  historyStore: MissionExecutionActivationHistoryStore;
  runtimeCapabilities?: RuntimeCapabilitySurface[];
  feedbackRecords?: Array<{
    executionActivationRecordId?: string;
    executionRequestRecordId: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    feedbackClass: ExecutionActivationFeedbackClass;
  }>;
}): MissionExecutionActivationProjection[] {
  const activationRecords = sortExecutionActivationRecords(
    input.coordination.executionRequestSummaries.map((request) => createExecutionActivationRecord({ request }))
  );

  const mappings = deriveExecutionRequestActivationMappings({
    requests: input.coordination.executionRequestSummaries,
    activationRecords,
  });

  const mappingByActivationId = new Map(mappings.map((entry) => [entry.executionActivationRecordId, entry]));

  const feedbackLinksFromRuntime = deriveExecutionActivationFeedbackLinks({
    activationRecords,
    feedbackRecords: input.feedbackRecords,
  });

  return activationRecords
    .map((activationRecord) => {
      const request = input.coordination.executionRequestSummaries
        .find((entry) => entry.executionRequestRecordId === activationRecord.executionRequestRecordId);
      const mapping = mappingByActivationId.get(activationRecord.executionActivationRecordId);

      if (!request || !mapping) {
        return null;
      }

      const activationHistory = input.historyStore.load({
        executionActivationRecordId: activationRecord.executionActivationRecordId,
      });

      const eligibility = deriveExecutionActivationEligibility({
        request,
        missionExecutionCoordinationProjection: input.coordination,
        runtimeCapabilities: input.runtimeCapabilities,
      });

      const runtimeFeedbackLinks = feedbackLinksFromRuntime
        .filter((entry) => entry.executionActivationRecordId === activationRecord.executionActivationRecordId);

      const replayFeedbackLinks = feedbackLinksFromHistory({
        executionActivationRecordId: activationRecord.executionActivationRecordId,
        executionRequestRecordId: activationRecord.executionRequestRecordId,
        historyEntries: activationHistory.entries,
      });

      const feedbackById = new Map(
        [...runtimeFeedbackLinks, ...replayFeedbackLinks].map((entry) => [entry.executionActivationFeedbackLinkId, entry])
      );
      const feedbackLinkSummaries = Array.from(feedbackById.values())
        .sort((left, right) => left.executionActivationFeedbackLinkId.localeCompare(right.executionActivationFeedbackLinkId));

      const queueEntry = deriveMissionExecutionActivationQueueEntry({
        activationRecord,
        eligibility,
        feedbackLinks: feedbackLinkSummaries,
        historyEntries: activationHistory.entries,
      });

      const status = deriveExecutionActivationStatus({
        executionActivationRecordId: activationRecord.executionActivationRecordId,
        queueEntry,
        feedbackLinks: feedbackLinkSummaries,
        historyEntries: activationHistory.entries,
      });

      const outcome = deriveExecutionActivationOutcome({
        executionActivationRecordId: activationRecord.executionActivationRecordId,
        status,
        feedbackLinks: feedbackLinkSummaries,
      });

      const statusPreview = {
        executionActivationRecordId: activationRecord.executionActivationRecordId,
        executionRequestRecordId: activationRecord.executionRequestRecordId,
        missionExecutionCoordinationPlanId: activationRecord.missionExecutionCoordinationPlanId,
        eligibilityStatus: eligibility.eligibilityStatus,
        queueState: queueEntry.queueState,
        status: status.status,
        outcome: outcome.outcome,
      } as Record<string, unknown>;

      const reportPreview = {
        activationRecord,
        mapping,
        eligibility,
        queueEntry,
        feedbackLinkSummaries,
        activationHistory,
        status,
        outcome,
      } as Record<string, unknown>;

      return {
        executionActivationRecordId: activationRecord.executionActivationRecordId,
        executionRequestRecordId: activationRecord.executionRequestRecordId,
        missionExecutionCoordinationPlanId: activationRecord.missionExecutionCoordinationPlanId,
        eligibilityStatus: eligibility.eligibilityStatus,
        queueState: queueEntry.queueState,
        feedbackLinkSummaries,
        status,
        outcome,
        priority: activationRecord.priority,
        linkedExecutionAttemptIds: summarizeLinkedExecutionAttemptIds(feedbackLinkSummaries),
        activationHistory,
        activationRecord,
        mapping,
        eligibility,
        queueEntry,
        statusPreview,
        reportPreview,
      } satisfies MissionExecutionActivationProjection;
    })
    .filter((entry): entry is MissionExecutionActivationProjection => entry !== null)
    .sort((left, right) => left.executionActivationRecordId.localeCompare(right.executionActivationRecordId));
}

export function createMissionExecutionActivationProjection(options: {
  coordinationProjection?: MissionExecutionCoordinationProjectionEngine;
  historyStore?: MissionExecutionActivationHistoryStore;
  runtimeCapabilities?: RuntimeCapabilitySurface[];
  feedbackRecords?: Array<{
    executionActivationRecordId?: string;
    executionRequestRecordId: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    feedbackClass: ExecutionActivationFeedbackClass;
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
  const coordinationProjection = options.coordinationProjection ?? createMissionExecutionCoordinationProjection({
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

  function projectAll(): MissionExecutionActivationProjection[] {
    const byId = new Map<string, MissionExecutionActivationProjection>();

    for (const coordination of coordinationProjection.projectAll()) {
      const projections = projectFromCoordination({
        coordination,
        historyStore,
        runtimeCapabilities: options.runtimeCapabilities,
        feedbackRecords: options.feedbackRecords,
      });

      for (const projection of projections) {
        byId.set(projection.executionActivationRecordId, projection);
      }
    }

    return Array.from(byId.values())
      .sort((left, right) => left.executionActivationRecordId.localeCompare(right.executionActivationRecordId));
  }

  function projectOne(input: { executionActivationRecordId: string }): MissionExecutionActivationProjection {
    const found = projectAll().find((entry) => entry.executionActivationRecordId === input.executionActivationRecordId);
    if (!found) {
      throw new Error('EXECUTION_ACTIVATION_RECORD_NOT_FOUND');
    }
    return found;
  }

  function listActivationRecords() {
    return projectAll().map((entry) => ({
      executionActivationRecordId: entry.executionActivationRecordId,
      executionRequestRecordId: entry.executionRequestRecordId,
      missionExecutionCoordinationPlanId: entry.missionExecutionCoordinationPlanId,
      priority: entry.priority,
      eligibilityStatus: entry.eligibilityStatus,
      queueState: entry.queueState,
      status: entry.status.status,
      outcome: entry.outcome.outcome,
    }));
  }

  function listActivationQueue() {
    return sortMissionExecutionActivationQueue(
      projectAll().map((entry) => entry.queueEntry)
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    );
  }

  return {
    projectAll,
    projectOne,
    listActivationRecords,
    listActivationQueue,
  };
}

export type MissionExecutionActivationProjectionEngine = ReturnType<typeof createMissionExecutionActivationProjection>;
