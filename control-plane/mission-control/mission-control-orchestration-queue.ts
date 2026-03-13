import {
  deriveMissionControlOrchestrationQueueEntryId,
  uniqueSortedStrings,
} from './mission-control-orchestration-identity.ts';
import type {
  MissionControlInterventionPlan,
  MissionControlOrchestrationQueueEntry,
  MissionControlOrchestrationQueueState,
} from './mission-control-orchestration-types.ts';

function queueStateForPlanState(planState: MissionControlInterventionPlan['state']): MissionControlOrchestrationQueueState {
  if (planState === 'active') {
    return 'under_orchestration';
  }
  if (planState === 'deferred') {
    return 'deferred';
  }
  if (planState === 'completed') {
    return 'closed';
  }
  if (planState === 'blocked') {
    return 'blocked';
  }
  if (planState === 'created') {
    return 'queued';
  }
  return 'awaiting_orchestration';
}

export function deriveMissionControlOrchestrationQueueEntry(input: {
  interventionPlan: MissionControlInterventionPlan;
  linkedPortfolioIds: string[];
  linkedBlockingClusterIds: string[];
  reasonTokens?: string[];
}): MissionControlOrchestrationQueueEntry | null {
  if (input.interventionPlan.state === 'inconclusive') {
    return null;
  }

  const queueState = queueStateForPlanState(input.interventionPlan.state);
  const reasonTokens = uniqueSortedStrings([
    ...(input.reasonTokens ?? []),
    `plan_state:${input.interventionPlan.state}`,
    `queue_state:${queueState}`,
    `priority:${input.interventionPlan.priority}`,
  ]);

  return {
    missionControlOrchestrationQueueEntryId: deriveMissionControlOrchestrationQueueEntryId({
      missionControlInterventionPlanId: input.interventionPlan.missionControlInterventionPlanId,
      priority: input.interventionPlan.priority,
      queueState,
      reasonTokens,
      linkedPortfolioIds: input.linkedPortfolioIds,
      linkedBlockingClusterIds: input.linkedBlockingClusterIds,
    }),
    missionControlInterventionPlanId: input.interventionPlan.missionControlInterventionPlanId,
    priority: input.interventionPlan.priority,
    queueState,
    reasonTokens,
    linkedPortfolioIds: uniqueSortedStrings(input.linkedPortfolioIds),
    linkedBlockingClusterIds: uniqueSortedStrings(input.linkedBlockingClusterIds),
    state: input.interventionPlan.state,
  };
}

function queueStateRank(queueState: MissionControlOrchestrationQueueState): number {
  if (queueState === 'under_orchestration') {
    return 6;
  }
  if (queueState === 'awaiting_orchestration') {
    return 5;
  }
  if (queueState === 'queued') {
    return 4;
  }
  if (queueState === 'deferred') {
    return 3;
  }
  if (queueState === 'blocked') {
    return 2;
  }
  return 1;
}

function priorityRank(priority: MissionControlOrchestrationQueueEntry['priority']): number {
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

export function sortMissionControlOrchestrationQueue(
  entries: MissionControlOrchestrationQueueEntry[]
): MissionControlOrchestrationQueueEntry[] {
  return [...entries].sort((left, right) => {
    const byQueueState = queueStateRank(right.queueState) - queueStateRank(left.queueState);
    if (byQueueState !== 0) {
      return byQueueState;
    }

    const byPriority = priorityRank(right.priority) - priorityRank(left.priority);
    if (byPriority !== 0) {
      return byPriority;
    }

    return left.missionControlInterventionPlanId.localeCompare(right.missionControlInterventionPlanId);
  });
}
