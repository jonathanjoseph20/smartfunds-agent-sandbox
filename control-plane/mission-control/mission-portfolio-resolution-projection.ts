import {
  createMissionPortfolioAttentionProjection,
  type MissionPortfolioAttentionProjectionEngine,
} from './mission-portfolio-attention-projection.ts';
import {
  createMissionPortfolioResolutionHistoryStore,
  type MissionPortfolioResolutionHistoryStore,
} from './mission-portfolio-resolution-history-store.ts';
import { deriveMissionPortfolioClosureEligibility } from './mission-portfolio-closure-eligibility.ts';
import { deriveMissionPortfolioClosureState } from './mission-portfolio-closure-state.ts';
import { deriveMissionPortfolioResolutionOutcome } from './mission-portfolio-resolution-outcome.ts';
import { deriveMissionPortfolioResolutionQueueEntry } from './mission-portfolio-resolution-queue.ts';
import { deriveMissionPortfolioResolutionStatus } from './mission-portfolio-resolution-status.ts';
import { deriveMissionPortfolioStabilization } from './mission-portfolio-stabilization.ts';
import { uniqueSortedStrings } from './mission-portfolio-resolution-identity.ts';
import type {
  MissionPortfolioResolutionHistoryEntry,
  MissionPortfolioResolutionProjection,
  MissionPortfolioResolutionQueueEntry,
  PortfolioResolutionActionRecord,
} from './mission-portfolio-resolution-types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return [];
  }

  return uniqueSortedStrings(value);
}

function parseActionRecord(entry: MissionPortfolioResolutionHistoryEntry): PortfolioResolutionActionRecord | null {
  const actionRecord = entry.payload.actionRecord;
  if (!isRecord(actionRecord)) {
    return null;
  }

  const portfolioResolutionActionRecordId = asString(actionRecord.portfolioResolutionActionRecordId);
  const missionPortfolioId = asString(actionRecord.missionPortfolioId);
  const portfolioResolutionQueueEntryId = asString(actionRecord.portfolioResolutionQueueEntryId);
  const actionType = asString(actionRecord.actionType) as PortfolioResolutionActionRecord['actionType'] | null;
  const actionOutcome = asString(actionRecord.actionOutcome) as PortfolioResolutionActionRecord['actionOutcome'] | null;
  const state = asString(actionRecord.state) as PortfolioResolutionActionRecord['state'] | null;
  const actor = asString(actionRecord.actor) as PortfolioResolutionActionRecord['actor'] | null;

  if (!portfolioResolutionActionRecordId || !missionPortfolioId || !portfolioResolutionQueueEntryId || !actionType || !actionOutcome || !state || !actor) {
    return null;
  }

  return {
    portfolioResolutionActionRecordId,
    missionPortfolioId,
    portfolioResolutionQueueEntryId,
    actionType,
    reasonTokens: asStringArray(actionRecord.reasonTokens),
    linkedRequirementIds: asStringArray(actionRecord.linkedRequirementIds),
    linkedEscalationIds: asStringArray(actionRecord.linkedEscalationIds),
    actionOutcome,
    actor,
    state,
  };
}

function queueStateRank(state: MissionPortfolioResolutionQueueEntry['queueState']): number {
  if (state === 'under_resolution_review') {
    return 5;
  }
  if (state === 'awaiting_resolution_review') {
    return 4;
  }
  if (state === 'ready_to_close') {
    return 3;
  }
  if (state === 'queued') {
    return 2;
  }
  if (state === 'deferred') {
    return 1;
  }
  return 0;
}

export function createMissionPortfolioResolutionProjection(options: {
  attentionProjection?: MissionPortfolioAttentionProjectionEngine;
  historyStore?: MissionPortfolioResolutionHistoryStore;
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
  const attentionProjection = options.attentionProjection ?? createMissionPortfolioAttentionProjection({
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

  const historyStore = options.historyStore ?? createMissionPortfolioResolutionHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function projectOne(input: { missionPortfolioId: string }): MissionPortfolioResolutionProjection {
    const attention = attentionProjection.projectOne({ missionPortfolioId: input.missionPortfolioId });
    const resolutionActionHistory = historyStore.replay({ missionPortfolioId: input.missionPortfolioId });
    const actionRecords = resolutionActionHistory
      .map((entry) => parseActionRecord(entry))
      .filter((entry): entry is PortfolioResolutionActionRecord => entry !== null)
      .sort((left, right) => left.portfolioResolutionActionRecordId.localeCompare(right.portfolioResolutionActionRecordId));

    const stabilization = deriveMissionPortfolioStabilization({
      attention,
      resolutionHistory: resolutionActionHistory,
    });

    const resolution = deriveMissionPortfolioResolutionStatus({
      attention,
      actionRecords,
    });

    const unresolvedRequirementCount = attention.attentionRequirements
      .filter((entry) => entry.state !== 'resolved')
      .length;

    const openEscalationCount = attention.escalations
      .filter((entry) => entry.state === 'open')
      .length;

    const blockingClusterCount = attention.linkedBlockingClusters.length;

    const closureEligibilityRecord = deriveMissionPortfolioClosureEligibility({
      missionPortfolioId: input.missionPortfolioId,
      stabilization,
      resolution,
      unresolvedRequirementCount,
      openEscalationCount,
      blockingClusterCount,
    });

    const closureState = deriveMissionPortfolioClosureState({
      closureEligibility: closureEligibilityRecord,
      resolution,
      actionRecords,
    });

    const isTerminal = closureState === 'archived';

    const queueReasonTokens = uniqueSortedStrings([
      ...stabilization.reasonTokens,
      ...resolution.reasonTokens,
      ...closureEligibilityRecord.reasonTokens,
    ]);

    const queueEntry = deriveMissionPortfolioResolutionQueueEntry({
      missionPortfolioId: input.missionPortfolioId,
      resolution,
      closureEligibility: closureEligibilityRecord,
      openEscalationCount,
      unresolvedRequirementCount,
      blockingClusterCount,
      criticalMissionCount: attention.priorityDistribution.criticalMissionCount,
      highMissionCount: attention.priorityDistribution.highMissionCount,
      historyEntries: resolutionActionHistory,
      reasonTokens: queueReasonTokens,
      isTerminal,
    });

    const resolutionOutcome = deriveMissionPortfolioResolutionOutcome({
      stabilization,
      resolution,
      closureState,
      actionRecords,
    });

    const linkedEscalations = uniqueSortedStrings(
      attention.escalations.map((entry) => entry.portfolioEscalationId)
    );

    const statusPreview = {
      missionPortfolioId: input.missionPortfolioId,
      portfolioResolutionQueueEntryId: queueEntry?.portfolioResolutionQueueEntryId ?? null,
      stabilizationStatus: stabilization.stabilizationStatus,
      resolutionStatus: resolution.resolutionStatus,
      closureEligibility: closureEligibilityRecord.closureEligibility,
      closureState,
      resolutionOutcome,
      linkedBlockingClusters: [...attention.linkedBlockingClusters],
      linkedEscalations,
      activeResolutionActionRecordId: actionRecords[actionRecords.length - 1]?.portfolioResolutionActionRecordId ?? null,
      queueState: queueEntry?.queueState ?? null,
    } as Record<string, unknown>;

    const reportPreview = {
      missionPortfolioId: input.missionPortfolioId,
      status: statusPreview,
      stabilization,
      resolution,
      closureEligibility: closureEligibilityRecord,
      queueEntry,
      closureState,
      resolutionOutcome,
      resolutionActionHistory,
      actionRecords,
      attention: attention.statusPreview,
    } as Record<string, unknown>;

    return {
      missionPortfolioId: input.missionPortfolioId,
      portfolioResolutionQueueEntryId: queueEntry?.portfolioResolutionQueueEntryId ?? null,
      stabilizationStatus: stabilization.stabilizationStatus,
      resolutionStatus: resolution.resolutionStatus,
      closureEligibility: closureEligibilityRecord.closureEligibility,
      closureState,
      resolutionOutcome,
      linkedBlockingClusters: [...attention.linkedBlockingClusters],
      linkedEscalations,
      activeResolutionActionRecordId: actionRecords[actionRecords.length - 1]?.portfolioResolutionActionRecordId ?? null,
      resolutionActionHistory,
      stabilization,
      resolution,
      closureEligibilityRecord,
      queueEntry,
      actionRecords,
      statusPreview,
      reportPreview,
    };
  }

  function projectAll(): MissionPortfolioResolutionProjection[] {
    const portfolioIds = attentionProjection.projectAll()
      .map((entry) => entry.missionPortfolioId)
      .sort((left, right) => left.localeCompare(right));

    return portfolioIds
      .map((missionPortfolioId) => projectOne({ missionPortfolioId }))
      .sort((left, right) => left.missionPortfolioId.localeCompare(right.missionPortfolioId));
  }

  function listResolutionQueue(): MissionPortfolioResolutionQueueEntry[] {
    return projectAll()
      .map((entry) => entry.queueEntry)
      .filter((entry): entry is MissionPortfolioResolutionQueueEntry => entry !== null)
      .filter((entry) => entry.queueState !== 'closed')
      .sort((left, right) => {
        const byState = queueStateRank(right.queueState) - queueStateRank(left.queueState);
        if (byState !== 0) {
          return byState;
        }

        const byPriority = right.priority - left.priority;
        if (byPriority !== 0) {
          return byPriority;
        }

        return left.missionPortfolioId.localeCompare(right.missionPortfolioId);
      });
  }

  return {
    projectOne,
    projectAll,
    listResolutionQueue,
  };
}

export type MissionPortfolioResolutionProjectionEngine = ReturnType<typeof createMissionPortfolioResolutionProjection>;
