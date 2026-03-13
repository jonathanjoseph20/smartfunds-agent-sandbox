import {
  createMissionControlOrchestrationProjection,
  type MissionControlOrchestrationProjectionEngine,
} from './mission-control-orchestration-projection.ts';
import type {
  MissionControlOrchestrationActionItem,
  MissionControlOrchestrationProjection,
} from './mission-control-orchestration-types.ts';
import {
  createMissionExecutionCoordinationHistoryStore,
  type MissionExecutionCoordinationHistoryStore,
} from './mission-execution-coordination-history-store.ts';
import {
  deriveMissionOrchestrationExecutionMappings,
} from './mission-orchestration-execution-mapping.ts';
import { deriveExecutionIntents } from './execution-intent.ts';
import { deriveExecutionRequestRecords, sortExecutionRequestQueue } from './execution-request-record.ts';
import {
  deriveExecutionFeedbackLinks,
  summarizeLinkedExecutionAttemptIds,
} from './execution-feedback-link.ts';
import { deriveMissionExecutionCoordinationStatus } from './mission-execution-coordination-status.ts';
import { deriveMissionExecutionCoordinationOutcome } from './mission-execution-coordination-outcome.ts';
import {
  deriveMissionExecutionCoordinationPlanId,
  uniqueSortedStrings,
} from './mission-execution-coordination-identity.ts';
import { deriveMissionExecutionCoordinationPlan } from './mission-execution-coordination-plan.ts';
import type {
  ExecutionFeedbackClass,
  ExecutionFeedbackLink,
  ExecutionIntent,
  ExecutionRequestRecord,
  MissionExecutionCoordinationProjection,
} from './mission-execution-coordination-types.ts';

function applyHistoryToRequests(input: {
  requests: ExecutionRequestRecord[];
  historyEntries: ReturnType<MissionExecutionCoordinationHistoryStore['replay']>;
}): ExecutionRequestRecord[] {
  const byId = new Map(input.requests.map((entry) => [entry.executionRequestRecordId, { ...entry }]));

  for (const entry of input.historyEntries) {
    const requestId = typeof entry.payload.executionRequestRecordId === 'string'
      ? entry.payload.executionRequestRecordId
      : null;

    if (!requestId) {
      continue;
    }

    const current = byId.get(requestId);
    if (!current) {
      continue;
    }

    if (entry.eventType === 'execution_request_queued') {
      current.state = 'queued';
      continue;
    }

    if (entry.eventType === 'execution_request_submitted') {
      current.state = 'submitted';
      continue;
    }

    if (entry.eventType === 'execution_coordination_deferred') {
      current.state = 'deferred';
      continue;
    }

    if (entry.eventType === 'execution_coordination_completed') {
      current.state = 'completed';
      continue;
    }

    if (entry.eventType === 'execution_coordination_failed') {
      current.state = 'failed';
    }
  }

  return sortExecutionRequestQueue(Array.from(byId.values()));
}

function feedbackLinksFromHistory(input: {
  missionExecutionCoordinationPlanId: string;
  historyEntries: ReturnType<MissionExecutionCoordinationHistoryStore['replay']>;
}): ExecutionFeedbackLink[] {
  return input.historyEntries
    .filter((entry) => entry.eventType === 'execution_feedback_linked')
    .map((entry) => {
      const payload = entry.payload;
      if (
        typeof payload.executionFeedbackLinkId !== 'string'
        || typeof payload.executionRequestRecordId !== 'string'
        || typeof payload.missionControlOrchestrationActionItemId !== 'string'
        || typeof payload.feedbackClass !== 'string'
      ) {
        return null;
      }

      return {
        executionFeedbackLinkId: payload.executionFeedbackLinkId,
        executionRequestRecordId: payload.executionRequestRecordId,
        executionAttemptId: typeof payload.executionAttemptId === 'string' ? payload.executionAttemptId : null,
        taskExecutionRunId: typeof payload.taskExecutionRunId === 'string' ? payload.taskExecutionRunId : null,
        workerResultId: typeof payload.workerResultId === 'string' ? payload.workerResultId : null,
        missionControlOrchestrationActionItemId: payload.missionControlOrchestrationActionItemId,
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
        feedbackClass: payload.feedbackClass as ExecutionFeedbackClass,
        state: 'linked',
      } satisfies ExecutionFeedbackLink;
    })
    .filter((entry): entry is ExecutionFeedbackLink => entry !== null)
    .sort((left, right) => left.executionFeedbackLinkId.localeCompare(right.executionFeedbackLinkId));
}

function toProjection(input: {
  orchestration: MissionControlOrchestrationProjection;
  historyStore: MissionExecutionCoordinationHistoryStore;
  feedbackRecords?: Array<{
    missionExecutionCoordinationPlanId: string;
    executionRequestRecordId: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    feedbackClass: ExecutionFeedbackClass;
  }>;
}): MissionExecutionCoordinationProjection {
  const linkedActionItemIds = uniqueSortedStrings(
    input.orchestration.actionItems.map((entry) => entry.missionControlOrchestrationActionItemId)
  );

  const missionExecutionCoordinationPlanId = deriveMissionExecutionCoordinationPlanId({
    missionControlInterventionPlanId: input.orchestration.missionControlInterventionPlanId,
    strategyClass: input.orchestration.interventionPlan.strategyClass,
    priority: input.orchestration.interventionPlan.priority,
    linkedActionItemIds,
  });

  const mappings = deriveMissionOrchestrationExecutionMappings({
    actionItems: input.orchestration.actionItems,
  });

  const intents = deriveExecutionIntents({
    missionExecutionCoordinationPlanId,
    mappings,
    actionItems: input.orchestration.actionItems,
  });

  const requests = deriveExecutionRequestRecords({
    missionExecutionCoordinationPlanId,
    intents,
    mappings,
    actionItems: input.orchestration.actionItems,
    priority: input.orchestration.interventionPlan.priority,
  });

  const history = input.historyStore.load({ missionExecutionCoordinationPlanId });
  const requestsWithHistory = applyHistoryToRequests({ requests, historyEntries: history.entries });

  const runtimeFeedbackLinks = deriveExecutionFeedbackLinks({
    missionExecutionCoordinationPlanId,
    requests: requestsWithHistory,
    feedbackRecords: (input.feedbackRecords ?? [])
      .filter((entry) => entry.missionExecutionCoordinationPlanId === missionExecutionCoordinationPlanId)
      .map((entry) => ({
        executionRequestRecordId: entry.executionRequestRecordId,
        executionAttemptId: entry.executionAttemptId,
        taskExecutionRunId: entry.taskExecutionRunId,
        workerResultId: entry.workerResultId,
        feedbackClass: entry.feedbackClass,
      })),
  });

  const replayFeedbackLinks = feedbackLinksFromHistory({
    missionExecutionCoordinationPlanId,
    historyEntries: history.entries,
  });

  const feedbackById = new Map([...runtimeFeedbackLinks, ...replayFeedbackLinks].map((entry) => [entry.executionFeedbackLinkId, entry]));
  const feedbackLinks = Array.from(feedbackById.values())
    .sort((left, right) => left.executionFeedbackLinkId.localeCompare(right.executionFeedbackLinkId));

  const plan = deriveMissionExecutionCoordinationPlan({
    missionControlInterventionPlanId: input.orchestration.missionControlInterventionPlanId,
    displayName: input.orchestration.displayName,
    strategyClass: input.orchestration.interventionPlan.strategyClass,
    priority: input.orchestration.interventionPlan.priority,
    linkedActionItemIds,
    intents,
    requests: requestsWithHistory,
  });

  const status = deriveMissionExecutionCoordinationStatus({
    missionExecutionCoordinationPlanId,
    requests: requestsWithHistory,
    feedbackLinks,
  });

  const outcome = deriveMissionExecutionCoordinationOutcome({
    missionExecutionCoordinationPlanId,
    status,
    requests: requestsWithHistory,
    feedbackLinks,
  });

  const statusPreview = {
    missionExecutionCoordinationPlanId,
    missionControlInterventionPlanId: input.orchestration.missionControlInterventionPlanId,
    status: status.status,
    outcome: outcome.outcome,
    priority: input.orchestration.interventionPlan.priority,
    executionRequestStates: requestsWithHistory.map((entry) => ({
      executionRequestRecordId: entry.executionRequestRecordId,
      state: entry.state,
      requestClass: entry.requestClass,
    })),
  } as Record<string, unknown>;

  const reportPreview = {
    missionExecutionCoordinationPlanId,
    missionControlInterventionPlanId: input.orchestration.missionControlInterventionPlanId,
    plan,
    mappings,
    intents,
    requests: requestsWithHistory,
    feedbackLinks,
    status,
    outcome,
    history,
  } as Record<string, unknown>;

  return {
    missionExecutionCoordinationPlanId,
    missionControlInterventionPlanId: input.orchestration.missionControlInterventionPlanId,
    executionIntentSummaries: intents,
    executionRequestSummaries: requestsWithHistory,
    feedbackLinkSummaries: feedbackLinks,
    status,
    outcome,
    priority: input.orchestration.interventionPlan.priority,
    linkedActionItemIds,
    linkedExecutionAttemptIds: summarizeLinkedExecutionAttemptIds(feedbackLinks),
    coordinationHistory: history,
    plan: {
      ...plan,
      state: status.status === 'execution_active'
        ? 'active'
        : (status.status === 'execution_completed'
            ? 'completed'
            : (status.status === 'execution_failed'
                ? 'failed'
                : (status.status === 'execution_deferred'
                    ? 'deferred'
                    : (status.status === 'inconclusive' ? 'inconclusive' : plan.state)))),
      outcome: outcome.outcome,
    },
    statusPreview,
    reportPreview,
  };
}

export function createMissionExecutionCoordinationProjection(options: {
  orchestrationProjection?: MissionControlOrchestrationProjectionEngine;
  historyStore?: MissionExecutionCoordinationHistoryStore;
  feedbackRecords?: Array<{
    missionExecutionCoordinationPlanId: string;
    executionRequestRecordId: string;
    executionAttemptId?: string | null;
    taskExecutionRunId?: string | null;
    workerResultId?: string | null;
    feedbackClass: ExecutionFeedbackClass;
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
  const orchestrationProjection = options.orchestrationProjection ?? createMissionControlOrchestrationProjection({
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

  const historyStore = options.historyStore ?? createMissionExecutionCoordinationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function projectAll(): MissionExecutionCoordinationProjection[] {
    const byId = new Map<string, MissionExecutionCoordinationProjection>();

    for (const orchestration of orchestrationProjection.projectAll()) {
      const projected = toProjection({
        orchestration,
        historyStore,
        feedbackRecords: options.feedbackRecords,
      });
      byId.set(projected.missionExecutionCoordinationPlanId, projected);
    }

    return Array.from(byId.values())
      .sort((left, right) => left.missionExecutionCoordinationPlanId.localeCompare(right.missionExecutionCoordinationPlanId));
  }

  function projectOne(input: { missionExecutionCoordinationPlanId: string }): MissionExecutionCoordinationProjection {
    const found = projectAll().find((entry) => entry.missionExecutionCoordinationPlanId === input.missionExecutionCoordinationPlanId);
    if (!found) {
      throw new Error('MISSION_EXECUTION_COORDINATION_PLAN_NOT_FOUND');
    }
    return found;
  }

  function listExecutionCoordinationPlans() {
    return projectAll().map((entry) => ({
      missionExecutionCoordinationPlanId: entry.missionExecutionCoordinationPlanId,
      missionControlInterventionPlanId: entry.missionControlInterventionPlanId,
      displayName: entry.plan.displayName,
      strategyClass: entry.plan.strategyClass,
      priority: entry.priority,
      state: entry.plan.state,
      outcome: entry.outcome.outcome,
    }));
  }

  return {
    projectAll,
    projectOne,
    listExecutionCoordinationPlans,
  };
}

export type MissionExecutionCoordinationProjectionEngine = ReturnType<typeof createMissionExecutionCoordinationProjection>;
