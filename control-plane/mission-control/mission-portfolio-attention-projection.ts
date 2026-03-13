import {
  createMissionPortfolioProjection,
  type MissionPortfolioProjectionEngine,
} from './mission-portfolio-projection.ts';
import {
  createMissionPortfolioAttentionHistoryStore,
  type MissionPortfolioAttentionHistoryStore,
} from './mission-portfolio-attention-history-store.ts';
import { deriveMissionPortfolioActionOutcome } from './mission-portfolio-action-outcome.ts';
import { deriveMissionPortfolioAttentionRequirements } from './mission-portfolio-attention-requirement.ts';
import { deriveMissionPortfolioEscalations } from './mission-portfolio-escalation.ts';
import {
  deriveMissionPortfolioAttentionQueueEntry,
  selectPrimaryAttentionRequirement,
} from './mission-portfolio-attention-queue.ts';
import { deriveMissionPortfolioAttentionStatus } from './mission-portfolio-attention-status.ts';
import type {
  MissionPortfolioActionType,
  MissionPortfolioAttentionHistoryEntry,
  MissionPortfolioAttentionProjection,
  MissionPortfolioEscalationSeverity,
  PortfolioOperatorActionRecord,
} from './mission-portfolio-attention-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function severityRank(severity: MissionPortfolioEscalationSeverity): number {
  if (severity === 'critical') {
    return 4;
  }
  if (severity === 'high') {
    return 3;
  }
  if (severity === 'medium') {
    return 2;
  }
  return 1;
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

function parseActionOutcome(actionType: MissionPortfolioActionType): PortfolioOperatorActionRecord['actionOutcome'] {
  if (actionType === 'acknowledge') {
    return 'acknowledged';
  }
  if (actionType === 'defer') {
    return 'deferred';
  }
  if (actionType === 'escalate') {
    return 'escalated';
  }
  if (actionType === 'suppress') {
    return 'suppressed';
  }
  if (actionType === 'force_review' || actionType === 'request_portfolio_review') {
    return 'review_requested';
  }
  return 'inconclusive';
}

function parseActionRecord(entry: MissionPortfolioAttentionHistoryEntry): PortfolioOperatorActionRecord | null {
  if (entry.eventType !== 'portfolio_operator_action_recorded') {
    return null;
  }

  const record = entry.payload.actionRecord;
  if (!isRecord(record)) {
    return null;
  }

  const portfolioOperatorActionRecordId = asString(record.portfolioOperatorActionRecordId);
  const missionPortfolioId = asString(record.missionPortfolioId);
  const portfolioAttentionQueueEntryId = asString(record.portfolioAttentionQueueEntryId);
  const actionType = asString(record.actionType) as MissionPortfolioActionType | null;
  const state = asString(record.state) as PortfolioOperatorActionRecord['state'] | null;

  if (!portfolioOperatorActionRecordId || !missionPortfolioId || !portfolioAttentionQueueEntryId || !actionType || !state) {
    return null;
  }

  return {
    portfolioOperatorActionRecordId,
    missionPortfolioId,
    portfolioAttentionQueueEntryId,
    actionType,
    reasonTokens: asStringArray(record.reasonTokens),
    linkedEscalationIds: asStringArray(record.linkedEscalationIds),
    linkedRequirementIds: asStringArray(record.linkedRequirementIds),
    actionOutcome: parseActionOutcome(actionType),
    state,
  };
}

function hasActiveForceReview(input: {
  actionRecords: PortfolioOperatorActionRecord[];
  history: MissionPortfolioAttentionHistoryEntry[];
}): boolean {
  let latestForceIndex = -1;
  let latestSuppressIndex = -1;

  for (let index = 0; index < input.actionRecords.length; index += 1) {
    const record = input.actionRecords[index];
    if (record.actionType === 'force_review' || record.actionType === 'request_portfolio_review') {
      latestForceIndex = index;
    }
    if (record.actionType === 'suppress') {
      latestSuppressIndex = index;
    }
  }

  for (let index = 0; index < input.history.length; index += 1) {
    const entry = input.history[index];
    if (entry.eventType !== 'portfolio_attention_required') {
      continue;
    }

    if (entry.reasonTokens.includes('operator_forced_attention_recorded')) {
      latestForceIndex = Math.max(latestForceIndex, index + 10_000);
    }
  }

  return latestForceIndex > latestSuppressIndex;
}

export function createMissionPortfolioAttentionProjection(options: {
  missionPortfolioProjection?: MissionPortfolioProjectionEngine;
  historyStore?: MissionPortfolioAttentionHistoryStore;
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
  const missionPortfolioProjection = options.missionPortfolioProjection ?? createMissionPortfolioProjection({
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

  const historyStore = options.historyStore ?? createMissionPortfolioAttentionHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function projectOne(input: { missionPortfolioId: string }): MissionPortfolioAttentionProjection {
    const portfolio = missionPortfolioProjection.projectOne({ missionPortfolioId: input.missionPortfolioId });
    const history = historyStore.getEvents({ missionPortfolioId: input.missionPortfolioId });
    const actionRecords = history
      .map((entry) => parseActionRecord(entry))
      .filter((entry): entry is PortfolioOperatorActionRecord => entry !== null);

    const requirements = deriveMissionPortfolioAttentionRequirements({
      portfolio,
      forceAttentionRequested: hasActiveForceReview({
        actionRecords,
        history,
      }),
    });

    const escalations = deriveMissionPortfolioEscalations({
      portfolio,
      requirements,
    });

    const primaryRequirement = selectPrimaryAttentionRequirement({ requirements });
    const primaryEscalation = primaryRequirement
      ? escalations.find((entry) => entry.linkedRequirementIds.includes(primaryRequirement.portfolioAttentionRequirementId)) ?? null
      : null;

    const actionOutcome = deriveMissionPortfolioActionOutcome({ actionRecords });

    const provisionalStatus = deriveMissionPortfolioAttentionStatus({
      actionOutcome: actionOutcome.actionOutcome,
      queueState: null,
      requirements,
      escalations,
    });

    const queueEntry = deriveMissionPortfolioAttentionQueueEntry({
      missionPortfolioId: input.missionPortfolioId,
      attentionStatus: provisionalStatus,
      requirement: primaryRequirement,
      escalation: primaryEscalation,
      criticalMissionCount: portfolio.priorityDistribution.criticalMissionCount,
      highMissionCount: portfolio.priorityDistribution.highMissionCount,
      historyEntries: history,
    });

    const attentionStatus = deriveMissionPortfolioAttentionStatus({
      actionOutcome: actionOutcome.actionOutcome,
      queueState: queueEntry?.queueState ?? null,
      requirements,
      escalations,
    });

    const linkedBlockingClusters = uniqueSorted(requirements.flatMap((entry) => entry.linkedBlockingClusterIds));

    const escalationSummaries = escalations.map((entry) => ({
      portfolioEscalationId: entry.portfolioEscalationId,
      escalationClass: entry.escalationClass,
      severity: entry.severity,
      state: entry.state,
    }));

    const statusPreview = {
      missionPortfolioId: input.missionPortfolioId,
      portfolioAttentionQueueEntryId: queueEntry?.portfolioAttentionQueueEntryId ?? null,
      attentionStatus,
      activeRequirementClasses: requirements.map((entry) => entry.requirementClass),
      escalationCount: escalations.length,
      actionOutcome: actionOutcome.actionOutcome,
      activeActionRecordId: actionOutcome.activeActionRecordId,
      queueState: queueEntry?.queueState ?? null,
      linkedBlockingClusters,
    } as Record<string, unknown>;

    const reportPreview = {
      missionPortfolioId: input.missionPortfolioId,
      status: statusPreview,
      requirements,
      escalations,
      queueEntry: queueEntry ? { ...queueEntry, attentionStatus } : null,
      actionOutcome,
      actionRecords,
      actionHistory: history,
      portfolio: portfolio.statusPreview,
    } as Record<string, unknown>;

    return {
      missionPortfolioId: input.missionPortfolioId,
      portfolioAttentionQueueEntryId: queueEntry?.portfolioAttentionQueueEntryId ?? null,
      attentionStatus,
      activeRequirementClasses: requirements.map((entry) => entry.requirementClass),
      escalationSummaries,
      actionOutcome: actionOutcome.actionOutcome,
      priorityDistribution: portfolio.priorityDistribution,
      linkedBlockingClusters,
      linkedMissionEscalations: [...portfolio.linkedEscalationSummaries],
      activeActionRecordId: actionOutcome.activeActionRecordId,
      actionHistory: [...history],
      attentionRequirements: requirements,
      escalations,
      queueEntry: queueEntry ? { ...queueEntry, attentionStatus } : null,
      actionRecords,
      statusPreview,
      reportPreview,
    };
  }

  function projectAll(): MissionPortfolioAttentionProjection[] {
    const portfolioIds = missionPortfolioProjection.summarizeList()
      .map((entry) => entry.missionPortfolioId)
      .sort((left, right) => left.localeCompare(right));

    return portfolioIds
      .map((missionPortfolioId) => projectOne({ missionPortfolioId }))
      .sort((left, right) => left.missionPortfolioId.localeCompare(right.missionPortfolioId));
  }

  function listAttentionQueue() {
    return projectAll()
      .map((entry) => {
        const severity = entry.escalations
          .find((escalation) => escalation.escalationClass === entry.queueEntry?.escalationClass)
          ?.severity ?? (entry.attentionRequirements[0]?.severity ?? 'low');
        return {
          queueEntry: entry.queueEntry,
          severity,
        };
      })
      .filter((entry): entry is { queueEntry: NonNullable<MissionPortfolioAttentionProjection['queueEntry']>; severity: MissionPortfolioEscalationSeverity } => entry.queueEntry !== null)
      .filter((entry) => entry.queueEntry.queueState !== 'closed')
      .sort((left, right) => {
        const bySeverity = severityRank(right.severity) - severityRank(left.severity);
        if (bySeverity !== 0) {
          return bySeverity;
        }

        const byPriority = right.queueEntry.priority - left.queueEntry.priority;
        if (byPriority !== 0) {
          return byPriority;
        }

        return left.queueEntry.missionPortfolioId.localeCompare(right.queueEntry.missionPortfolioId);
      })
      .map((entry) => entry.queueEntry);
  }

  return {
    projectOne,
    projectAll,
    listAttentionQueue,
  };
}

export type MissionPortfolioAttentionProjectionEngine = ReturnType<typeof createMissionPortfolioAttentionProjection>;
