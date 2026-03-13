import { createPortfolioOperatorActionRecord } from './mission-portfolio-action-record.ts';
import {
  createMissionPortfolioAttentionHistoryStore,
  type MissionPortfolioAttentionHistoryStore,
} from './mission-portfolio-attention-history-store.ts';
import {
  createMissionPortfolioAttentionProjection,
  type MissionPortfolioAttentionProjectionEngine,
} from './mission-portfolio-attention-projection.ts';
import type {
  MissionPortfolioActionType,
  MissionPortfolioAttentionHistoryEventType,
} from './mission-portfolio-attention-types.ts';

function uniqueSorted(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function eventTypeForAction(actionType: MissionPortfolioActionType): MissionPortfolioAttentionHistoryEventType {
  if (actionType === 'acknowledge') {
    return 'portfolio_attention_acknowledged';
  }
  if (actionType === 'defer') {
    return 'portfolio_attention_deferred';
  }
  if (actionType === 'escalate') {
    return 'portfolio_attention_escalated';
  }
  if (actionType === 'suppress') {
    return 'portfolio_attention_suppressed';
  }
  return 'portfolio_attention_queued';
}

function appendAction(input: {
  missionPortfolioId: string;
  actionType: MissionPortfolioActionType;
  requestedBy: string;
  reasonTokens?: string[];
  linkedEscalationIds?: string[];
  linkedRequirementIds?: string[];
  projection: MissionPortfolioAttentionProjectionEngine;
  historyStore: MissionPortfolioAttentionHistoryStore;
}) {
  const reasonTokens = uniqueSorted([`requested_by:${input.requestedBy}`, ...(input.reasonTokens ?? [])]);
  const linkedEscalationIds = uniqueSorted(input.linkedEscalationIds);
  const linkedRequirementIds = uniqueSorted(input.linkedRequirementIds);

  const projected = input.projection.projectOne({ missionPortfolioId: input.missionPortfolioId });
  const queueEntry = projected.queueEntry;

  if (!queueEntry && input.actionType !== 'force_review' && input.actionType !== 'request_portfolio_review') {
    throw new Error('MISSION_PORTFOLIO_ATTENTION_QUEUE_ENTRY_NOT_FOUND');
  }

  if (!queueEntry && (input.actionType === 'force_review' || input.actionType === 'request_portfolio_review')) {
    input.historyStore.appendEvent({
      missionPortfolioId: input.missionPortfolioId,
      eventType: 'portfolio_attention_required',
      reasonTokens: uniqueSorted(['operator_forced_attention_recorded', ...reasonTokens]),
      payload: {
        missionPortfolioId: input.missionPortfolioId,
        actionType: input.actionType,
      },
    });
  }

  if (queueEntry) {
    input.historyStore.appendEvent({
      missionPortfolioId: input.missionPortfolioId,
      eventType: 'portfolio_attention_required',
      reasonTokens,
      payload: {
        missionPortfolioId: input.missionPortfolioId,
        requirementClass: queueEntry.requirementClass,
      },
    });

    input.historyStore.appendEvent({
      missionPortfolioId: input.missionPortfolioId,
      eventType: 'portfolio_attention_queued',
      reasonTokens,
      payload: {
        portfolioAttentionQueueEntryId: queueEntry.portfolioAttentionQueueEntryId,
        queueEntry,
      },
    });
  }

  const refreshed = input.projection.projectOne({ missionPortfolioId: input.missionPortfolioId });
  const activeQueueEntryId = refreshed.queueEntry?.portfolioAttentionQueueEntryId;

  if (!activeQueueEntryId) {
    throw new Error('MISSION_PORTFOLIO_ATTENTION_QUEUE_ENTRY_NOT_FOUND');
  }

  if (input.actionType === 'escalate') {
    input.historyStore.appendEvent({
      missionPortfolioId: input.missionPortfolioId,
      eventType: 'portfolio_escalation_opened',
      reasonTokens,
      payload: {
        missionPortfolioId: input.missionPortfolioId,
        escalationIds: refreshed.escalations.map((entry) => entry.portfolioEscalationId),
      },
    });
  }

  const actionRecord = createPortfolioOperatorActionRecord({
    missionPortfolioId: input.missionPortfolioId,
    portfolioAttentionQueueEntryId: activeQueueEntryId,
    actionType: input.actionType,
    reasonTokens,
    linkedEscalationIds: linkedEscalationIds.length > 0
      ? linkedEscalationIds
      : refreshed.escalations.map((entry) => entry.portfolioEscalationId),
    linkedRequirementIds: linkedRequirementIds.length > 0
      ? linkedRequirementIds
      : refreshed.attentionRequirements.map((entry) => entry.portfolioAttentionRequirementId),
  });

  input.historyStore.appendEvent({
    missionPortfolioId: input.missionPortfolioId,
    eventType: 'portfolio_operator_action_recorded',
    reasonTokens,
    payload: {
      portfolioAttentionQueueEntryId: activeQueueEntryId,
      actionRecord,
    },
  });

  input.historyStore.appendEvent({
    missionPortfolioId: input.missionPortfolioId,
    eventType: eventTypeForAction(input.actionType),
    reasonTokens,
    payload: {
      portfolioAttentionQueueEntryId: activeQueueEntryId,
      actionRecordId: actionRecord.portfolioOperatorActionRecordId,
    },
  });

  if (input.actionType === 'suppress') {
    input.historyStore.appendEvent({
      missionPortfolioId: input.missionPortfolioId,
      eventType: 'portfolio_attention_closed',
      reasonTokens,
      payload: {
        portfolioAttentionQueueEntryId: activeQueueEntryId,
        queueEntry: refreshed.queueEntry,
      },
    });
  }

  return input.projection.projectOne({ missionPortfolioId: input.missionPortfolioId });
}

export function createMissionPortfolioAttentionManager(options: {
  projection?: MissionPortfolioAttentionProjectionEngine;
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
  const historyStore = options.historyStore ?? createMissionPortfolioAttentionHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  const projection = options.projection ?? createMissionPortfolioAttentionProjection({
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
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  function acknowledgePortfolio(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedRequirementIds?: string[];
  }) {
    return appendAction({
      missionPortfolioId: input.missionPortfolioId,
      actionType: 'acknowledge',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedRequirementIds: input.linkedRequirementIds,
      projection,
      historyStore,
    });
  }

  function deferPortfolio(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedRequirementIds?: string[];
  }) {
    return appendAction({
      missionPortfolioId: input.missionPortfolioId,
      actionType: 'defer',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedRequirementIds: input.linkedRequirementIds,
      projection,
      historyStore,
    });
  }

  function escalatePortfolio(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedRequirementIds?: string[];
  }) {
    return appendAction({
      missionPortfolioId: input.missionPortfolioId,
      actionType: 'escalate',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedRequirementIds: input.linkedRequirementIds,
      projection,
      historyStore,
    });
  }

  function forcePortfolioReview(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedRequirementIds?: string[];
  }) {
    return appendAction({
      missionPortfolioId: input.missionPortfolioId,
      actionType: 'force_review',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedRequirementIds: input.linkedRequirementIds,
      projection,
      historyStore,
    });
  }

  function suppressPortfolioAttention(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedRequirementIds?: string[];
  }) {
    return appendAction({
      missionPortfolioId: input.missionPortfolioId,
      actionType: 'suppress',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedRequirementIds: input.linkedRequirementIds,
      projection,
      historyStore,
    });
  }

  function requestPortfolioReview(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedRequirementIds?: string[];
  }) {
    return appendAction({
      missionPortfolioId: input.missionPortfolioId,
      actionType: 'request_portfolio_review',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedRequirementIds: input.linkedRequirementIds,
      projection,
      historyStore,
    });
  }

  return {
    acknowledgePortfolio,
    deferPortfolio,
    escalatePortfolio,
    forcePortfolioReview,
    suppressPortfolioAttention,
    requestPortfolioReview,
  };
}

export type MissionPortfolioAttentionManager = ReturnType<typeof createMissionPortfolioAttentionManager>;
