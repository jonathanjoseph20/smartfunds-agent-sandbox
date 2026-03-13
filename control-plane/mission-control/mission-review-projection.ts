import {
  createMissionCoordinationProjection,
  type MissionCoordinationProjectionEngine,
} from './mission-coordination-projection.ts';
import {
  createMissionRunProjection,
  type MissionRunProjectionEngine,
} from './mission-run-projection.ts';
import { deriveMissionDecisionOutcome } from './mission-decision-outcome.ts';
import {
  createMissionReviewHistoryStore,
  type MissionReviewHistoryStore,
} from './mission-review-history-store.ts';
import { deriveMissionReviewRequirements } from './mission-review-requirement.ts';
import { deriveMissionGovernanceStatus } from './mission-review-status.ts';
import {
  deriveMissionReviewQueueEntry,
  selectPrimaryReviewRequirement,
} from './mission-review-queue.ts';
import type {
  MissionReviewHistoryEntry,
  MissionReviewProjection,
  OperatorDecisionRecord,
} from './mission-review-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

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

  return uniqueSorted(value.map((entry) => entry.trim()).filter((entry) => entry.length > 0));
}

function parseDecisionRecord(entry: MissionReviewHistoryEntry): OperatorDecisionRecord | null {
  if (entry.eventType !== 'mission_decision_recorded') {
    return null;
  }

  const record = entry.payload.decisionRecord;
  if (!isRecord(record)) {
    return null;
  }

  const decisionRecordId = asString(record.decisionRecordId);
  const missionRunId = asString(record.missionRunId);
  const reviewQueueEntryId = asString(record.reviewQueueEntryId);
  const decisionType = asString(record.decisionType) as OperatorDecisionRecord['decisionType'] | null;
  const decisionOutcome = asString(record.decisionOutcome) as OperatorDecisionRecord['decisionOutcome'] | null;
  const state = asString(record.state) as OperatorDecisionRecord['state'] | null;

  if (!decisionRecordId || !missionRunId || !reviewQueueEntryId || !decisionType || !decisionOutcome || !state) {
    return null;
  }

  return {
    decisionRecordId,
    missionRunId,
    reviewQueueEntryId,
    decisionType,
    decisionOutcome,
    reasonTokens: asStringArray(record.reasonTokens),
    linkedEscalationIds: asStringArray(record.linkedEscalationIds),
    linkedInterventionIds: asStringArray(record.linkedInterventionIds),
    state,
  };
}

function priorityWeight(priority: string): number {
  if (priority === 'critical') {
    return 5;
  }
  if (priority === 'high') {
    return 4;
  }
  if (priority === 'normal') {
    return 3;
  }
  if (priority === 'low') {
    return 2;
  }
  return 1;
}

export function createMissionReviewProjection(options: {
  missionRunProjection?: MissionRunProjectionEngine;
  missionCoordinationProjection?: MissionCoordinationProjectionEngine;
  historyStore?: MissionReviewHistoryStore;
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
  const missionRunProjection = options.missionRunProjection ?? createMissionRunProjection({
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

  const missionCoordinationProjection = options.missionCoordinationProjection ?? createMissionCoordinationProjection({
    missionRunProjection,
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

  const historyStore = options.historyStore ?? createMissionReviewHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function projectOne(input: { missionRunId: string }): MissionReviewProjection {
    const coordination = missionCoordinationProjection.projectOne({ missionRunId: input.missionRunId });
    const reviewHistory = historyStore.load({ missionRunId: input.missionRunId });
    const decisionRecords = reviewHistory.entries
      .map((entry) => parseDecisionRecord(entry))
      .filter((entry): entry is OperatorDecisionRecord => entry !== null);

    const reviewRequirements = deriveMissionReviewRequirements({
      missionRunId: input.missionRunId,
      coordination,
      historyEntries: reviewHistory.entries,
    });

    const decisionOutcome = deriveMissionDecisionOutcome({ decisionRecords });

    const provisionalGovernanceStatus = deriveMissionGovernanceStatus({
      decisionOutcome: decisionOutcome.decisionOutcome,
      queueState: null,
      reviewRequirements,
    });

    const primaryRequirement = selectPrimaryReviewRequirement({ reviewRequirements });

    const queueEntry = deriveMissionReviewQueueEntry({
      missionRunId: input.missionRunId,
      reviewRequirement: primaryRequirement,
      governanceStatus: provisionalGovernanceStatus,
      historyEntries: reviewHistory.entries,
    });

    const governanceStatus = deriveMissionGovernanceStatus({
      decisionOutcome: decisionOutcome.decisionOutcome,
      queueState: queueEntry?.queueState ?? null,
      reviewRequirements,
    });

    const linkedEscalations = uniqueSorted([
      ...coordination.blockedByEscalations,
      ...reviewRequirements.flatMap((entry) => entry.linkedEscalationIds),
      ...decisionRecords.flatMap((entry) => entry.linkedEscalationIds),
    ]);

    const linkedDependencies = uniqueSorted([
      ...coordination.blockingMissionRunIds,
      ...reviewRequirements.flatMap((entry) => entry.linkedDependencyIds),
    ]);

    const statusPreview = {
      missionRunId: input.missionRunId,
      reviewQueueEntryId: queueEntry?.reviewQueueEntryId ?? null,
      governanceStatus,
      reviewRequirementClass: primaryRequirement?.reviewRequirementClass ?? null,
      decisionOutcome: decisionOutcome.decisionOutcome,
      priority: coordination.priority,
      queueState: queueEntry?.queueState ?? null,
      activeDecisionRecordId: decisionOutcome.activeDecisionRecordId,
      linkedEscalations,
      linkedDependencies,
    } as Record<string, unknown>;

    const reportPreview = {
      missionRunId: input.missionRunId,
      status: statusPreview,
      reviewRequirements,
      decisionRecords,
      decisionHistory: reviewHistory.entries,
      coordination: coordination.statusPreview,
    } as Record<string, unknown>;

    return {
      missionRunId: input.missionRunId,
      reviewQueueEntryId: queueEntry?.reviewQueueEntryId ?? null,
      governanceStatus,
      reviewRequirementClass: primaryRequirement?.reviewRequirementClass ?? null,
      decisionOutcome: decisionOutcome.decisionOutcome,
      priority: coordination.priority,
      activeDecisionRecordId: decisionOutcome.activeDecisionRecordId,
      decisionHistory: [...reviewHistory.entries],
      linkedEscalations,
      linkedDependencies,
      queueState: queueEntry?.queueState ?? null,
      coordination,
      reviewRequirements,
      queueEntry: queueEntry
        ? {
          ...queueEntry,
          governanceStatus,
        }
        : null,
      decisionRecords,
      statusPreview,
      reportPreview,
    };
  }

  function projectAll(): MissionReviewProjection[] {
    const runIds = missionRunProjection.summarizeList()
      .map((entry) => entry.missionRunId)
      .sort((left, right) => left.localeCompare(right));

    return runIds
      .map((missionRunId) => projectOne({ missionRunId }))
      .sort((left, right) => left.missionRunId.localeCompare(right.missionRunId));
  }

  function summarizeQueue() {
    return projectAll()
      .map((projection) => projection.queueEntry)
      .filter((entry): entry is NonNullable<MissionReviewProjection['queueEntry']> => entry !== null)
      .filter((entry) => entry.queueState !== 'closed')
      .sort((left, right) => {
        const byPriority = priorityWeight(right.priority) - priorityWeight(left.priority);
        if (byPriority !== 0) {
          return byPriority;
        }

        const byQueueState = left.queueState.localeCompare(right.queueState);
        if (byQueueState !== 0) {
          return byQueueState;
        }

        return left.missionRunId.localeCompare(right.missionRunId);
      });
  }

  return {
    projectOne,
    projectAll,
    summarizeQueue,
  };
}

export type MissionReviewProjectionEngine = ReturnType<typeof createMissionReviewProjection>;
