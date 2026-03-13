import { createPortfolioResolutionActionRecord } from './mission-portfolio-resolution-action-record.ts';
import {
  createMissionPortfolioResolutionHistoryStore,
  type MissionPortfolioResolutionHistoryStore,
} from './mission-portfolio-resolution-history-store.ts';
import {
  createMissionPortfolioResolutionProjection,
  type MissionPortfolioResolutionProjectionEngine,
} from './mission-portfolio-resolution-projection.ts';
import { uniqueSortedStrings } from './mission-portfolio-resolution-identity.ts';
import type {
  MissionPortfolioResolutionActionType,
  MissionPortfolioResolutionHistoryEventType,
} from './mission-portfolio-resolution-types.ts';

function eventTypeForAction(actionType: MissionPortfolioResolutionActionType): MissionPortfolioResolutionHistoryEventType {
  if (actionType === 'mark_stable') {
    return 'portfolio_marked_stable';
  }
  if (actionType === 'mark_resolved') {
    return 'portfolio_marked_resolved';
  }
  if (actionType === 'defer_closure') {
    return 'portfolio_closure_deferred';
  }
  if (actionType === 'close') {
    return 'portfolio_closed';
  }
  if (actionType === 'reopen') {
    return 'portfolio_reopened';
  }
  if (actionType === 'archive') {
    return 'portfolio_archived';
  }
  return 'portfolio_resolution_queued';
}

function appendAction(input: {
  missionPortfolioId: string;
  actionType: MissionPortfolioResolutionActionType;
  requestedBy: string;
  reasonTokens?: string[];
  linkedRequirementIds?: string[];
  linkedEscalationIds?: string[];
  projection: MissionPortfolioResolutionProjectionEngine;
  historyStore: MissionPortfolioResolutionHistoryStore;
}) {
  const reasonTokens = uniqueSortedStrings([`requested_by:${input.requestedBy}`, ...(input.reasonTokens ?? [])]);
  const linkedRequirementIds = uniqueSortedStrings(input.linkedRequirementIds);
  const linkedEscalationIds = uniqueSortedStrings(input.linkedEscalationIds);

  const projected = input.projection.projectOne({ missionPortfolioId: input.missionPortfolioId });

  if (projected.closureState === 'archived' && input.actionType !== 'reopen') {
    throw new Error('MISSION_PORTFOLIO_RESOLUTION_ARCHIVED');
  }

  input.historyStore.appendEvent({
    missionPortfolioId: input.missionPortfolioId,
    eventType: 'portfolio_resolution_started',
    reasonTokens,
    payload: {
      missionPortfolioId: input.missionPortfolioId,
      resolutionStatus: projected.resolutionStatus,
    },
  });

  if (projected.stabilizationStatus !== 'inconclusive') {
    input.historyStore.appendEvent({
      missionPortfolioId: input.missionPortfolioId,
      eventType: 'portfolio_stabilization_detected',
      reasonTokens,
      payload: {
        missionPortfolioId: input.missionPortfolioId,
        stabilizationStatus: projected.stabilizationStatus,
      },
    });
  }

  const queueEntryId = projected.queueEntry?.portfolioResolutionQueueEntryId
    ?? `pending-${input.missionPortfolioId}`;

  input.historyStore.appendEvent({
    missionPortfolioId: input.missionPortfolioId,
    eventType: 'portfolio_resolution_queued',
    reasonTokens,
    payload: {
      portfolioResolutionQueueEntryId: queueEntryId,
      queueEntry: projected.queueEntry,
    },
  });

  const actionRecord = createPortfolioResolutionActionRecord({
    missionPortfolioId: input.missionPortfolioId,
    portfolioResolutionQueueEntryId: queueEntryId,
    actionType: input.actionType,
    reasonTokens,
    linkedRequirementIds: linkedRequirementIds.length > 0
      ? linkedRequirementIds
      : projected.resolution.linkedRequirementIds,
    linkedEscalationIds: linkedEscalationIds.length > 0
      ? linkedEscalationIds
      : projected.linkedEscalations,
  });

  input.historyStore.appendEvent({
    missionPortfolioId: input.missionPortfolioId,
    eventType: eventTypeForAction(input.actionType),
    reasonTokens,
    payload: {
      portfolioResolutionQueueEntryId: queueEntryId,
      actionRecord,
    },
  });

  if (input.actionType === 'close' || input.actionType === 'archive') {
    input.historyStore.appendEvent({
      missionPortfolioId: input.missionPortfolioId,
      eventType: 'portfolio_resolution_closed',
      reasonTokens,
      payload: {
        portfolioResolutionQueueEntryId: queueEntryId,
        actionRecordId: actionRecord.portfolioResolutionActionRecordId,
      },
    });
  }

  return input.projection.projectOne({ missionPortfolioId: input.missionPortfolioId });
}

export function createMissionPortfolioResolutionManager(options: {
  projection?: MissionPortfolioResolutionProjectionEngine;
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
  const historyStore = options.historyStore ?? createMissionPortfolioResolutionHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  const projection = options.projection ?? createMissionPortfolioResolutionProjection({
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

  function markPortfolioStable(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedRequirementIds?: string[];
    linkedEscalationIds?: string[];
  }) {
    return appendAction({
      ...input,
      actionType: 'mark_stable',
      requestedBy: input.requestedBy ?? 'operator',
      projection,
      historyStore,
    });
  }

  function markPortfolioResolved(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedRequirementIds?: string[];
    linkedEscalationIds?: string[];
  }) {
    return appendAction({
      ...input,
      actionType: 'mark_resolved',
      requestedBy: input.requestedBy ?? 'operator',
      projection,
      historyStore,
    });
  }

  function closePortfolio(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedRequirementIds?: string[];
    linkedEscalationIds?: string[];
  }) {
    return appendAction({
      ...input,
      actionType: 'close',
      requestedBy: input.requestedBy ?? 'operator',
      projection,
      historyStore,
    });
  }

  function reopenPortfolio(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedRequirementIds?: string[];
    linkedEscalationIds?: string[];
  }) {
    return appendAction({
      ...input,
      actionType: 'reopen',
      requestedBy: input.requestedBy ?? 'operator',
      projection,
      historyStore,
    });
  }

  function archivePortfolio(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedRequirementIds?: string[];
    linkedEscalationIds?: string[];
  }) {
    return appendAction({
      ...input,
      actionType: 'archive',
      requestedBy: input.requestedBy ?? 'operator',
      projection,
      historyStore,
    });
  }

  function deferPortfolioClosure(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedRequirementIds?: string[];
    linkedEscalationIds?: string[];
  }) {
    return appendAction({
      ...input,
      actionType: 'defer_closure',
      requestedBy: input.requestedBy ?? 'operator',
      projection,
      historyStore,
    });
  }

  function requestPortfolioResolutionReview(input: {
    missionPortfolioId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedRequirementIds?: string[];
    linkedEscalationIds?: string[];
  }) {
    return appendAction({
      ...input,
      actionType: 'request_resolution_review',
      requestedBy: input.requestedBy ?? 'operator',
      projection,
      historyStore,
    });
  }

  return {
    markPortfolioStable,
    markPortfolioResolved,
    closePortfolio,
    reopenPortfolio,
    archivePortfolio,
    deferPortfolioClosure,
    requestPortfolioResolutionReview,
  };
}

export type MissionPortfolioResolutionManager = ReturnType<typeof createMissionPortfolioResolutionManager>;
