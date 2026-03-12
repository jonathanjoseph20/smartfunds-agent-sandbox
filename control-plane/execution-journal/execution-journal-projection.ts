import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createExecutionAttemptProjection,
  type ExecutionAttemptProjectionEngine,
} from '../execution-attempt/execution-attempt-projection.ts';

import {
  createExecutionJournalHistoryStore,
  resolveExecutionJournalArtifactPaths,
  type ExecutionJournalHistoryStore,
} from './execution-journal-history-store.ts';
import { deriveExecutionJournalStatus } from './execution-journal-status.ts';
import type {
  ExecutionJournalProjection,
  MissionExecutionJournal,
} from './execution-journal-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function computeLatestEventDigest(input: { event: unknown }): string {
  return sha256(canonicalStringify(input.event));
}

export function deriveExecutionJournalId(input: {
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
}): string {
  return sha256(canonicalStringify({
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
  }));
}

export function createExecutionJournalProjection(options: {
  executionAttemptProjection?: ExecutionAttemptProjectionEngine;
  historyStore?: ExecutionJournalHistoryStore;
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

  function projectOne(input: { executionAttemptId: string }): ExecutionJournalProjection {
    const attemptProjection = executionAttemptProjection.projectOne({ executionAttemptId: input.executionAttemptId });

    const executionJournalId = deriveExecutionJournalId({
      executionAttemptId: attemptProjection.executionAttemptId,
      runtimeEnvelopeId: attemptProjection.runtimeEnvelopeId,
      executionContractId: attemptProjection.executionContractId,
      missionId: attemptProjection.missionId,
    });

    const history = historyStore.load({
      executionJournalId,
      executionAttemptId: attemptProjection.executionAttemptId,
      runtimeEnvelopeId: attemptProjection.runtimeEnvelopeId,
      executionContractId: attemptProjection.executionContractId,
      missionId: attemptProjection.missionId,
    });

    const status = deriveExecutionJournalStatus({
      executionAttempt: attemptProjection,
      events: history.events,
    });

    const latestEvent = history.events[history.events.length - 1];
    const latestEventDigest = latestEvent
      ? computeLatestEventDigest({ event: latestEvent })
      : undefined;

    const projection: MissionExecutionJournal = {
      executionJournalId,
      executionAttemptId: attemptProjection.executionAttemptId,
      runtimeEnvelopeId: attemptProjection.runtimeEnvelopeId,
      executionContractId: attemptProjection.executionContractId,
      missionId: attemptProjection.missionId,
      attemptIndex: attemptProjection.attemptIndex,
      journalState: status.journalState,
      eventCount: history.events.length,
      ...(latestEvent ? { latestEventType: latestEvent.eventType } : {}),
      ...(latestEventDigest ? { latestEventDigest } : {}),
      events: history.events,
      limitations: uniqueSorted(status.limitations),
      blockers: uniqueSorted(status.blockers),
      provenanceInputs: {
        attemptState: attemptProjection.attemptState,
        attemptLifecycleState: attemptProjection.attemptLifecycleState,
        attemptBlockers: uniqueSorted(attemptProjection.blockers),
        attemptLimitations: uniqueSorted(attemptProjection.limitations),
      },
    };

    const artifactPaths = resolveExecutionJournalArtifactPaths({
      executionJournalId,
      rootDir: options.executionJournalArtifactsRoot,
    });

    const statusPreview = {
      executionJournalId,
      executionAttemptId: projection.executionAttemptId,
      runtimeEnvelopeId: projection.runtimeEnvelopeId,
      executionContractId: projection.executionContractId,
      missionId: projection.missionId,
      journalState: projection.journalState,
      eventCount: projection.eventCount,
      latestEventType: projection.latestEventType ?? null,
      latestEventDigest: projection.latestEventDigest ?? null,
      blockers: projection.blockers,
      limitations: projection.limitations,
      readinessSignals: status.readinessSignals,
    } as Record<string, unknown>;

    const reportPreview = {
      ...projection,
      readinessSignals: status.readinessSignals,
    } as Record<string, unknown>;

    return {
      ...projection,
      statusPreview,
      reportPreview,
      artifactPaths,
    };
  }

  function projectAll(): ExecutionJournalProjection[] {
    return executionAttemptProjection
      .projectAll()
      .map((attempt) => projectOne({ executionAttemptId: attempt.executionAttemptId }))
      .sort((left, right) => left.executionJournalId.localeCompare(right.executionJournalId));
  }

  function summarizeList(): Array<{
    executionJournalId: string;
    executionAttemptId: string;
    journalState: MissionExecutionJournal['journalState'];
    eventCount: number;
    latestEventType?: MissionExecutionJournal['latestEventType'];
  }> {
    return projectAll()
      .map((entry) => ({
        executionJournalId: entry.executionJournalId,
        executionAttemptId: entry.executionAttemptId,
        journalState: entry.journalState,
        eventCount: entry.eventCount,
        ...(entry.latestEventType ? { latestEventType: entry.latestEventType } : {}),
      }))
      .sort((left, right) => left.executionJournalId.localeCompare(right.executionJournalId));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type ExecutionJournalProjectionEngine = ReturnType<typeof createExecutionJournalProjection>;
