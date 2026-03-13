import { createOperatorDecisionRecord } from './mission-decision-record.ts';
import { deriveMissionReviewQueueEntryId } from './mission-review-identity.ts';
import {
  createMissionReviewHistoryStore,
  type MissionReviewHistoryStore,
} from './mission-review-history-store.ts';
import {
  createMissionReviewProjection,
  type MissionReviewProjectionEngine,
} from './mission-review-projection.ts';
import type { MissionDecisionType } from './mission-review-types.ts';

function uniqueSorted(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function ensureActiveQueue(input: {
  missionRunId: string;
  projection: MissionReviewProjectionEngine;
  historyStore: MissionReviewHistoryStore;
  reasonTokens: string[];
  forceReview?: boolean;
}): { reviewQueueEntryId: string; reviewRequirementClass: string } {
  const projected = input.projection.projectOne({ missionRunId: input.missionRunId });
  if (projected.queueEntry) {
    return {
      reviewQueueEntryId: projected.queueEntry.reviewQueueEntryId,
      reviewRequirementClass: projected.queueEntry.reviewRequirementClass,
    };
  }

  if (!input.forceReview) {
    throw new Error('MISSION_REVIEW_QUEUE_ENTRY_NOT_FOUND');
  }

  const forceReasonTokens = uniqueSorted(['operator_force_review_recorded', ...input.reasonTokens]);
  const forceQueueReasonTokens = ['operator_force_review_recorded'];
  const history = input.historyStore.load({ missionRunId: input.missionRunId });
  const closedCycleCount = history.entries.filter((entry) => {
    if (entry.eventType !== 'mission_review_closed') {
      return false;
    }
    return (entry.payload.queueEntry as Record<string, unknown> | undefined)?.reviewRequirementClass === 'operator_forced_review';
  }).length;
  const queueCycle = closedCycleCount + 1;
  const reviewQueueEntryId = deriveMissionReviewQueueEntryId({
    missionRunId: input.missionRunId,
    reviewRequirementClass: 'operator_forced_review',
    queueCycle,
    reasonTokens: forceQueueReasonTokens,
  });

  input.historyStore.appendReviewEvent({
    missionRunId: input.missionRunId,
    eventType: 'mission_review_queued',
    reasonTokens: forceReasonTokens,
    payload: {
      reviewQueueEntryId,
      queueEntry: {
        reviewQueueEntryId,
        missionRunId: input.missionRunId,
        reviewRequirementClass: 'operator_forced_review',
      },
    },
  });

  return {
    reviewQueueEntryId,
    reviewRequirementClass: 'operator_forced_review',
  };
}

function appendDecision(input: {
  missionRunId: string;
  decisionType: MissionDecisionType;
  requestedBy: string;
  reasonTokens?: string[];
  linkedEscalationIds?: string[];
  linkedInterventionIds?: string[];
  projection: MissionReviewProjectionEngine;
  historyStore: MissionReviewHistoryStore;
}): ReturnType<MissionReviewProjectionEngine['projectOne']> {
  const reasonTokens = uniqueSorted([`requested_by:${input.requestedBy}`, ...(input.reasonTokens ?? [])]);
  const linkedEscalationIds = uniqueSorted(input.linkedEscalationIds);
  const linkedInterventionIds = uniqueSorted(input.linkedInterventionIds);

  const queue = ensureActiveQueue({
    missionRunId: input.missionRunId,
    projection: input.projection,
    historyStore: input.historyStore,
    reasonTokens,
    forceReview: input.decisionType === 'force_review',
  });

  input.historyStore.appendReviewEvent({
    missionRunId: input.missionRunId,
    eventType: 'mission_review_queued',
    reasonTokens,
    payload: {
      reviewQueueEntryId: queue.reviewQueueEntryId,
      queueEntry: {
        reviewQueueEntryId: queue.reviewQueueEntryId,
        missionRunId: input.missionRunId,
        reviewRequirementClass: queue.reviewRequirementClass,
      },
    },
  });

  input.historyStore.appendReviewEvent({
    missionRunId: input.missionRunId,
    eventType: 'mission_review_started',
    reasonTokens,
    payload: {
      reviewQueueEntryId: queue.reviewQueueEntryId,
      requestedBy: input.requestedBy,
    },
  });

  const decisionRecord = createOperatorDecisionRecord({
    missionRunId: input.missionRunId,
    reviewQueueEntryId: queue.reviewQueueEntryId,
    decisionType: input.decisionType,
    reasonTokens,
    linkedEscalationIds,
    linkedInterventionIds,
  });

  input.historyStore.appendDecisionEvent({
    missionRunId: input.missionRunId,
    eventType: 'mission_decision_recorded',
    reasonTokens,
    payload: {
      reviewQueueEntryId: queue.reviewQueueEntryId,
      decisionRecord,
    },
  });

  if (input.decisionType === 'approve') {
    input.historyStore.appendDecisionEvent({
      missionRunId: input.missionRunId,
      eventType: 'mission_approved',
      reasonTokens,
      payload: {
        reviewQueueEntryId: queue.reviewQueueEntryId,
        decisionRecordId: decisionRecord.decisionRecordId,
      },
    });

    input.historyStore.appendReviewEvent({
      missionRunId: input.missionRunId,
      eventType: 'mission_review_closed',
      reasonTokens,
      payload: {
        reviewQueueEntryId: queue.reviewQueueEntryId,
        queueEntry: {
          reviewQueueEntryId: queue.reviewQueueEntryId,
          missionRunId: input.missionRunId,
          reviewRequirementClass: queue.reviewRequirementClass,
        },
      },
    });
  }

  if (input.decisionType === 'reject') {
    input.historyStore.appendDecisionEvent({
      missionRunId: input.missionRunId,
      eventType: 'mission_rejected',
      reasonTokens,
      payload: {
        reviewQueueEntryId: queue.reviewQueueEntryId,
        decisionRecordId: decisionRecord.decisionRecordId,
      },
    });

    input.historyStore.appendReviewEvent({
      missionRunId: input.missionRunId,
      eventType: 'mission_review_closed',
      reasonTokens,
      payload: {
        reviewQueueEntryId: queue.reviewQueueEntryId,
        queueEntry: {
          reviewQueueEntryId: queue.reviewQueueEntryId,
          missionRunId: input.missionRunId,
          reviewRequirementClass: queue.reviewRequirementClass,
        },
      },
    });
  }

  if (input.decisionType === 'defer') {
    input.historyStore.appendReviewEvent({
      missionRunId: input.missionRunId,
      eventType: 'mission_review_deferred',
      reasonTokens,
      payload: {
        reviewQueueEntryId: queue.reviewQueueEntryId,
        decisionRecordId: decisionRecord.decisionRecordId,
      },
    });
  }

  if (input.decisionType === 'request_changes') {
    input.historyStore.appendDecisionEvent({
      missionRunId: input.missionRunId,
      eventType: 'mission_changes_requested',
      reasonTokens,
      payload: {
        reviewQueueEntryId: queue.reviewQueueEntryId,
        decisionRecordId: decisionRecord.decisionRecordId,
      },
    });

    input.historyStore.appendReviewEvent({
      missionRunId: input.missionRunId,
      eventType: 'mission_review_closed',
      reasonTokens,
      payload: {
        reviewQueueEntryId: queue.reviewQueueEntryId,
        queueEntry: {
          reviewQueueEntryId: queue.reviewQueueEntryId,
          missionRunId: input.missionRunId,
          reviewRequirementClass: queue.reviewRequirementClass,
        },
      },
    });
  }

  if (input.decisionType === 'force_review') {
    input.historyStore.appendReviewEvent({
      missionRunId: input.missionRunId,
      eventType: 'mission_review_escalated',
      reasonTokens,
      payload: {
        reviewQueueEntryId: queue.reviewQueueEntryId,
        decisionRecordId: decisionRecord.decisionRecordId,
      },
    });
  }

  return input.projection.projectOne({ missionRunId: input.missionRunId });
}

export function createMissionReviewManager(options: {
  projection?: MissionReviewProjectionEngine;
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
  const historyStore = options.historyStore ?? createMissionReviewHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  const projection = options.projection ?? createMissionReviewProjection({
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

  function approveMission(input: {
    missionRunId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedInterventionIds?: string[];
  }) {
    return appendDecision({
      missionRunId: input.missionRunId,
      decisionType: 'approve',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedInterventionIds: input.linkedInterventionIds,
      projection,
      historyStore,
    });
  }

  function rejectMission(input: {
    missionRunId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedInterventionIds?: string[];
  }) {
    return appendDecision({
      missionRunId: input.missionRunId,
      decisionType: 'reject',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedInterventionIds: input.linkedInterventionIds,
      projection,
      historyStore,
    });
  }

  function deferMissionReview(input: {
    missionRunId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedInterventionIds?: string[];
  }) {
    return appendDecision({
      missionRunId: input.missionRunId,
      decisionType: 'defer',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedInterventionIds: input.linkedInterventionIds,
      projection,
      historyStore,
    });
  }

  function requestMissionChanges(input: {
    missionRunId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedInterventionIds?: string[];
  }) {
    return appendDecision({
      missionRunId: input.missionRunId,
      decisionType: 'request_changes',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedInterventionIds: input.linkedInterventionIds,
      projection,
      historyStore,
    });
  }

  function forceMissionReview(input: {
    missionRunId: string;
    requestedBy?: string;
    reasonTokens?: string[];
    linkedEscalationIds?: string[];
    linkedInterventionIds?: string[];
  }) {
    return appendDecision({
      missionRunId: input.missionRunId,
      decisionType: 'force_review',
      requestedBy: input.requestedBy ?? 'operator',
      reasonTokens: input.reasonTokens,
      linkedEscalationIds: input.linkedEscalationIds,
      linkedInterventionIds: input.linkedInterventionIds,
      projection,
      historyStore,
    });
  }

  return {
    approveMission,
    rejectMission,
    deferMissionReview,
    requestMissionChanges,
    forceMissionReview,
  };
}

export type MissionReviewManager = ReturnType<typeof createMissionReviewManager>;
