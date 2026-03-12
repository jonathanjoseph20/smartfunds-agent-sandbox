import type {
  MissionCompletionState,
  MissionHealthState,
  MissionProgressSummary,
} from './mission-run-types.ts';

export function deriveMissionHealthState(input: {
  progressSummary: MissionProgressSummary;
  completionState: MissionCompletionState;
  executionEngineEligibilityState?: string;
  orchestrationCycleState?: string;
  escalationCount?: number;
}): MissionHealthState {
  const progress = input.progressSummary;
  const escalationCount = input.escalationCount ?? 0;

  if (input.completionState === 'failed') {
    return 'failed';
  }

  if (input.completionState === 'blocked' || progress.remainingBlockingNodes.length > 0) {
    return 'blocked';
  }

  if (input.executionEngineEligibilityState === 'inconclusive') {
    return 'inconclusive';
  }

  if (
    escalationCount > 0
    || progress.retryingTaskCount > 0
    || input.orchestrationCycleState === 'incomplete'
    || input.orchestrationCycleState === 'blocked'
  ) {
    return 'degraded';
  }

  if (progress.runningTaskCount > 0 || progress.readyTaskCount > 0 || progress.pendingTaskCount > 0) {
    return 'unstable';
  }

  if (input.completionState === 'completed') {
    return 'healthy';
  }

  return 'inconclusive';
}
