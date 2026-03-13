import type {
  MissionControlOrchestrationActionItem,
  MissionControlOrchestrationOutcome,
  MissionControlOrchestrationOutcomeRecord,
  MissionControlOrchestrationQueueEntry,
  MissionControlOrchestrationHistoryEntry,
} from './mission-control-orchestration-types.ts';
import { uniqueSortedStrings } from './mission-control-orchestration-identity.ts';

export function deriveMissionControlOrchestrationOutcome(input: {
  missionControlInterventionPlanId: string;
  planState:
    | 'created'
    | 'queued'
    | 'active'
    | 'deferred'
    | 'completed'
    | 'blocked'
    | 'inconclusive';
  queueEntry: MissionControlOrchestrationQueueEntry | null;
  actionItems: MissionControlOrchestrationActionItem[];
  historyEntries: MissionControlOrchestrationHistoryEntry[];
}): MissionControlOrchestrationOutcomeRecord {
  let outcome: MissionControlOrchestrationOutcome = 'pending';

  if (input.planState === 'inconclusive') {
    outcome = 'inconclusive';
  } else if (input.planState === 'blocked') {
    outcome = 'blocked';
  } else if (input.planState === 'completed') {
    outcome = 'completed';
  } else if (input.planState === 'deferred') {
    outcome = 'deferred';
  }

  if (outcome === 'pending' && input.actionItems.some((entry) => entry.state === 'inconclusive')) {
    outcome = 'inconclusive';
  } else if (outcome === 'pending' && (input.actionItems.some((entry) => entry.state === 'blocked') || input.queueEntry?.queueState === 'blocked')) {
    outcome = 'blocked';
  } else if (outcome === 'pending' && input.actionItems.every((entry) => entry.state === 'completed') && input.actionItems.length > 0) {
    outcome = 'completed';
  } else if (outcome === 'pending' && (input.actionItems.some((entry) => entry.state === 'deferred') || input.queueEntry?.queueState === 'deferred')) {
    outcome = 'deferred';
  } else if (outcome === 'pending' && (input.actionItems.some((entry) => entry.state === 'active') || input.queueEntry?.queueState === 'under_orchestration')) {
    outcome = 'active';
  } else if (outcome === 'pending' && (input.queueEntry?.queueState === 'awaiting_orchestration' || input.queueEntry?.queueState === 'queued')) {
    outcome = 'stabilizing';
  }

  if (input.historyEntries.some((entry) => entry.eventType === 'mission_control_orchestration_completed')) {
    outcome = 'completed';
  }
  if (input.historyEntries.some((entry) => entry.eventType === 'mission_control_orchestration_blocked')) {
    outcome = 'blocked';
  }

  return {
    missionControlInterventionPlanId: input.missionControlInterventionPlanId,
    outcome,
    reasonTokens: uniqueSortedStrings([
      `queue_state:${input.queueEntry?.queueState ?? 'none'}`,
      `action_count:${String(input.actionItems.length)}`,
      `active_action_count:${String(input.actionItems.filter((entry) => entry.state === 'active').length)}`,
      `completed_action_count:${String(input.actionItems.filter((entry) => entry.state === 'completed').length)}`,
      `outcome:${outcome}`,
    ]),
  };
}
