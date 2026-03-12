import type {
  MissionCompletionState,
  MissionProgressSummary,
} from './mission-run-types.ts';

export function deriveMissionCompletionState(input: {
  progressSummary: MissionProgressSummary;
  executionEngineState?: string;
}): MissionCompletionState {
  const progress = input.progressSummary;

  if (progress.totalTaskCount === 0) {
    return input.executionEngineState === 'failed' ? 'failed' : 'not_started';
  }

  if (progress.failedTaskCount > 0 || input.executionEngineState === 'failed') {
    return 'failed';
  }

  if (progress.completedTaskCount === progress.totalTaskCount) {
    return 'completed';
  }

  if (progress.blockedTaskCount > 0 || progress.remainingBlockingNodes.length > 0) {
    return 'blocked';
  }

  if (progress.completedTaskCount > 0) {
    return 'partially_complete';
  }

  if (progress.runningTaskCount > 0 || progress.retryingTaskCount > 0 || progress.readyTaskCount > 0 || progress.pendingTaskCount > 0) {
    return 'in_progress';
  }

  return 'inconclusive';
}
