import {
  createCrossPortfolioMissionIntelligenceProjection,
  type CrossPortfolioMissionIntelligenceProjectionEngine,
} from './cross-portfolio-intelligence-projection.ts';
import {
  createMissionPortfolioAttentionProjection,
  type MissionPortfolioAttentionProjectionEngine,
} from './mission-portfolio-attention-projection.ts';
import {
  createMissionPortfolioResolutionProjection,
  type MissionPortfolioResolutionProjectionEngine,
} from './mission-portfolio-resolution-projection.ts';
import {
  createMissionReviewProjection,
  type MissionReviewProjectionEngine,
} from './mission-review-projection.ts';
import {
  deriveMissionControlInterventionPlan,
} from './mission-control-intervention-plan.ts';
import {
  deriveMissionControlInterventionPlanId,
  uniqueSortedStrings,
} from './mission-control-orchestration-identity.ts';
import {
  createMissionControlOrchestrationHistoryStore,
  type MissionControlOrchestrationHistoryStore,
} from './mission-control-orchestration-history-store.ts';
import { deriveMissionControlOrchestrationActionItems } from './mission-control-orchestration-action.ts';
import { deriveMissionControlOrchestrationQueueEntry, sortMissionControlOrchestrationQueue } from './mission-control-orchestration-queue.ts';
import { deriveMissionControlOrchestrationPriority } from './mission-control-orchestration-priority.ts';
import { deriveMissionControlOrchestrationOutcome } from './mission-control-orchestration-outcome.ts';
import {
  deriveSystemicStabilizationStrategy,
  deriveSystemicStabilizationStrategyClass,
} from './systemic-stabilization-strategy.ts';
import type {
  MissionControlInterventionPlan,
  MissionControlOrchestrationActionItem,
  MissionControlOrchestrationProjection,
  MissionControlOrchestrationQueueEntry,
} from './mission-control-orchestration-types.ts';

function applyHistoryToActionItems(input: {
  actionItems: MissionControlOrchestrationActionItem[];
  historyEntries: ReturnType<MissionControlOrchestrationHistoryStore['replay']>;
}): MissionControlOrchestrationActionItem[] {
  const byId = new Map(input.actionItems.map((entry) => [entry.missionControlOrchestrationActionItemId, { ...entry }]));
  const stateRank: Record<MissionControlOrchestrationActionItem['state'], number> = {
    pending: 1,
    active: 2,
    deferred: 3,
    blocked: 4,
    inconclusive: 5,
    completed: 6,
  };

  for (const entry of input.historyEntries) {
    const actionItemId = entry.payload.missionControlOrchestrationActionItemId as string | undefined;
    if (!actionItemId) {
      continue;
    }

    const current = byId.get(actionItemId);
    if (!current) {
      continue;
    }

    if (entry.eventType === 'mission_control_action_item_deferred') {
      if (stateRank.deferred > stateRank[current.state]) {
        current.state = 'deferred';
      }
      continue;
    }

    if (entry.eventType === 'mission_control_action_item_completed') {
      if (stateRank.completed > stateRank[current.state]) {
        current.state = 'completed';
      }
      continue;
    }
  }

  return Array.from(byId.values())
    .sort((left, right) => left.missionControlOrchestrationActionItemId.localeCompare(right.missionControlOrchestrationActionItemId));
}

function applyHistoryToPlanState(input: {
  interventionPlan: MissionControlInterventionPlan;
  historyEntries: ReturnType<MissionControlOrchestrationHistoryStore['replay']>;
}): MissionControlInterventionPlan {
  let state = input.interventionPlan.state;

  for (const entry of input.historyEntries) {
    if (entry.eventType === 'mission_control_orchestration_queued') {
      state = 'queued';
      continue;
    }

    if (entry.eventType === 'mission_control_orchestration_started') {
      state = 'active';
      continue;
    }

    if (entry.eventType === 'mission_control_orchestration_blocked') {
      state = 'blocked';
      continue;
    }

    if (entry.eventType === 'mission_control_orchestration_completed') {
      state = 'completed';
    }
  }

  return {
    ...input.interventionPlan,
    state,
  };
}

function deriveLinkedRequirementIds(input: {
  portfolioIds: string[];
  attentionProjection: MissionPortfolioAttentionProjectionEngine;
  resolutionProjection: MissionPortfolioResolutionProjectionEngine;
  governanceProjection: MissionReviewProjectionEngine;
}): string[] {
  const fromPortfolios = input.portfolioIds.flatMap((missionPortfolioId) => {
    const attention = input.attentionProjection.projectOne({ missionPortfolioId });
    const resolution = input.resolutionProjection.projectOne({ missionPortfolioId });

    return [
      ...attention.attentionRequirements.map((entry) => entry.portfolioAttentionRequirementId),
      ...resolution.resolution.linkedRequirementIds,
    ];
  });

  const governance = input.governanceProjection.summarizeQueue();
  const governanceLinked = governance.flatMap((entry) => entry.linkedDependencies);

  return uniqueSortedStrings([...fromPortfolios, ...governanceLinked]);
}

function toProjection(input: {
  crossPortfolio: ReturnType<CrossPortfolioMissionIntelligenceProjectionEngine['projectOne']>;
  historyStore: MissionControlOrchestrationHistoryStore;
  attentionProjection: MissionPortfolioAttentionProjectionEngine;
  resolutionProjection: MissionPortfolioResolutionProjectionEngine;
  governanceProjection: MissionReviewProjectionEngine;
}): MissionControlOrchestrationProjection {
  const priorityPosture = deriveMissionControlOrchestrationPriority({ projection: input.crossPortfolio });
  const strategyClass = deriveSystemicStabilizationStrategyClass({
    projection: input.crossPortfolio,
    priority: priorityPosture.priority,
  });

  const missionControlInterventionPlanId = deriveMissionControlInterventionPlanId({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolio.crossPortfolioMissionIntelligenceSetId,
    strategyClass,
    portfolioIds: input.crossPortfolio.portfolioIds,
    systemicBlockingClusterIds: input.crossPortfolio.systemicBlockingClusters.map((entry) => entry.systemicBlockingClusterId),
    escalationPatternIds: input.crossPortfolio.escalationPatterns.map((entry) => entry.crossPortfolioEscalationPatternId),
  });

  const linkedRequirementIds = deriveLinkedRequirementIds({
    portfolioIds: input.crossPortfolio.portfolioIds,
    attentionProjection: input.attentionProjection,
    resolutionProjection: input.resolutionProjection,
    governanceProjection: input.governanceProjection,
  });

  const baseActionItems = deriveMissionControlOrchestrationActionItems({
    missionControlInterventionPlanId,
    projection: input.crossPortfolio,
    strategyClass,
    priority: priorityPosture.priority,
  }).map((entry) => ({
    ...entry,
    linkedRequirementIds: uniqueSortedStrings([...entry.linkedRequirementIds, ...linkedRequirementIds]),
  }));

  let interventionPlan = deriveMissionControlInterventionPlan({
    projection: input.crossPortfolio,
    strategyClass,
    priority: priorityPosture.priority,
    actionItemIds: baseActionItems.map((entry) => entry.missionControlOrchestrationActionItemId),
  });

  const history = input.historyStore.load({ missionControlInterventionPlanId });
  const actionItems = applyHistoryToActionItems({ actionItems: baseActionItems, historyEntries: history.entries });
  interventionPlan = applyHistoryToPlanState({ interventionPlan, historyEntries: history.entries });

  const stabilizationStrategy = deriveSystemicStabilizationStrategy({
    missionControlInterventionPlanId,
    projection: input.crossPortfolio,
    strategyClass,
    priority: priorityPosture.priority,
  });

  const orchestrationQueue = deriveMissionControlOrchestrationQueueEntry({
    interventionPlan,
    linkedPortfolioIds: input.crossPortfolio.portfolioIds,
    linkedBlockingClusterIds: input.crossPortfolio.systemicBlockingClusters.map((entry) => entry.systemicBlockingClusterId),
    reasonTokens: priorityPosture.reasonTokens,
  });

  const orchestrationOutcome = deriveMissionControlOrchestrationOutcome({
    missionControlInterventionPlanId,
    planState: interventionPlan.state,
    queueEntry: orchestrationQueue,
    actionItems,
    historyEntries: history.entries,
  });

  interventionPlan = {
    ...interventionPlan,
    outcome: orchestrationOutcome.outcome,
    priority: priorityPosture.priority,
  };

  const enrichedPriorityPosture = {
    ...priorityPosture,
    missionControlInterventionPlanId,
  };

  const statusPreview = {
    missionControlInterventionPlanId,
    crossPortfolioMissionIntelligenceSetId: interventionPlan.crossPortfolioMissionIntelligenceSetId,
    state: interventionPlan.state,
    strategyClass: interventionPlan.strategyClass,
    priority: interventionPlan.priority,
    outcome: interventionPlan.outcome,
    queueState: orchestrationQueue?.queueState ?? null,
    actionItemStates: actionItems.map((entry) => ({
      missionControlOrchestrationActionItemId: entry.missionControlOrchestrationActionItemId,
      actionClass: entry.actionClass,
      state: entry.state,
      priority: entry.priority,
    })),
  } as Record<string, unknown>;

  const reportPreview = {
    missionControlInterventionPlanId,
    displayName: interventionPlan.displayName,
    interventionPlan,
    stabilizationStrategy,
    actionItems,
    orchestrationQueue,
    priorityPosture: enrichedPriorityPosture,
    orchestrationOutcome,
    orchestrationHistory: history,
  } as Record<string, unknown>;

  return {
    missionControlInterventionPlanId,
    crossPortfolioMissionIntelligenceSetId: interventionPlan.crossPortfolioMissionIntelligenceSetId,
    displayName: interventionPlan.displayName,
    interventionPlan,
    stabilizationStrategy,
    actionItems,
    orchestrationQueue,
    priorityPosture: enrichedPriorityPosture,
    orchestrationOutcome,
    orchestrationHistory: history,
    orchestrationHistorySummary: {
      totalEvents: history.entries.length,
      lastEventType: history.entries[history.entries.length - 1]?.eventType ?? null,
    },
    interventionPlanPosture: {
      state: interventionPlan.state,
      priority: interventionPlan.priority,
      outcome: interventionPlan.outcome,
    },
    stabilizationStrategySummary: {
      strategyClass: stabilizationStrategy.strategyClass,
      state: stabilizationStrategy.state,
      reasonTokens: stabilizationStrategy.reasonTokens,
    },
    actionItemStates: actionItems.map((entry) => ({
      missionControlOrchestrationActionItemId: entry.missionControlOrchestrationActionItemId,
      actionClass: entry.actionClass,
      state: entry.state,
      priority: entry.priority,
    })),
    queueStateSummary: {
      queueState: orchestrationQueue?.queueState ?? null,
      state: interventionPlan.state,
    },
    statusPreview,
    reportPreview,
  };
}

export function createMissionControlOrchestrationProjection(options: {
  crossPortfolioProjection?: CrossPortfolioMissionIntelligenceProjectionEngine;
  attentionProjection?: MissionPortfolioAttentionProjectionEngine;
  resolutionProjection?: MissionPortfolioResolutionProjectionEngine;
  governanceProjection?: MissionReviewProjectionEngine;
  historyStore?: MissionControlOrchestrationHistoryStore;
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
  const crossPortfolioProjection = options.crossPortfolioProjection ?? createCrossPortfolioMissionIntelligenceProjection({
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

  const resolutionProjection = options.resolutionProjection ?? createMissionPortfolioResolutionProjection({
    attentionProjection,
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

  const governanceProjection = options.governanceProjection ?? createMissionReviewProjection({
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

  const historyStore = options.historyStore ?? createMissionControlOrchestrationHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function projectAll(): MissionControlOrchestrationProjection[] {
    const byId = new Map<string, MissionControlOrchestrationProjection>();
    for (const crossPortfolio of crossPortfolioProjection.projectAll()) {
      const projected = toProjection({
        crossPortfolio,
        historyStore,
        attentionProjection,
        resolutionProjection,
        governanceProjection,
      });
      byId.set(projected.missionControlInterventionPlanId, projected);
    }

    return Array.from(byId.values())
      .sort((left, right) => left.missionControlInterventionPlanId.localeCompare(right.missionControlInterventionPlanId));
  }

  function projectOne(input: { missionControlInterventionPlanId: string }): MissionControlOrchestrationProjection {
    const found = projectAll().find((entry) => entry.missionControlInterventionPlanId === input.missionControlInterventionPlanId);
    if (!found) {
      throw new Error('MISSION_CONTROL_ORCHESTRATION_PLAN_NOT_FOUND');
    }
    return found;
  }

  function listInterventionPlans() {
    return projectAll().map((entry) => ({
      missionControlInterventionPlanId: entry.missionControlInterventionPlanId,
      crossPortfolioMissionIntelligenceSetId: entry.crossPortfolioMissionIntelligenceSetId,
      displayName: entry.displayName,
      strategyClass: entry.interventionPlan.strategyClass,
      portfolioIds: entry.interventionPlan.portfolioIds,
      priority: entry.interventionPlan.priority,
      outcome: entry.interventionPlan.outcome,
      state: entry.interventionPlan.state,
    }));
  }

  function inspectOrchestrationQueue(): MissionControlOrchestrationQueueEntry[] {
    const queueEntries = projectAll()
      .map((entry) => entry.orchestrationQueue)
      .filter((entry): entry is MissionControlOrchestrationQueueEntry => entry !== null)
      .filter((entry) => entry.queueState !== 'closed');

    return sortMissionControlOrchestrationQueue(queueEntries);
  }

  return {
    projectOne,
    projectAll,
    listInterventionPlans,
    inspectOrchestrationQueue,
  };
}

export type MissionControlOrchestrationProjectionEngine = ReturnType<typeof createMissionControlOrchestrationProjection>;
