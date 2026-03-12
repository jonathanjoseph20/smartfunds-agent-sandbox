import type { MissionProgressSummary } from './mission-run-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function toPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Number(((completed / total) * 100).toFixed(2));
}

export function deriveMissionProgress(input: {
  taskExecutionProjection?: {
    nodeStates: Record<string, string>;
    blockingNodes: string[];
  } | null;
  taskOrchestrationProjection?: {
    deferredNodes: Array<{ taskNodeId: string }>;
  } | null;
}): MissionProgressSummary {
  const nodeStates = input.taskExecutionProjection?.nodeStates ?? {};

  let pendingTaskCount = 0;
  let readyTaskCount = 0;
  let runningTaskCount = 0;
  let retryingTaskCount = 0;
  let completedTaskCount = 0;
  let failedTaskCount = 0;
  let blockedTaskCount = 0;
  let skippedTaskCount = 0;

  for (const state of Object.values(nodeStates)) {
    if (state === 'pending') {
      pendingTaskCount += 1;
      continue;
    }
    if (state === 'ready') {
      readyTaskCount += 1;
      continue;
    }
    if (state === 'running') {
      runningTaskCount += 1;
      continue;
    }
    if (state === 'retrying') {
      retryingTaskCount += 1;
      continue;
    }
    if (state === 'completed') {
      completedTaskCount += 1;
      continue;
    }
    if (state === 'failed' || state === 'permanently_failed') {
      failedTaskCount += 1;
      continue;
    }
    if (state === 'blocked') {
      blockedTaskCount += 1;
      continue;
    }
    if (state === 'skipped') {
      skippedTaskCount += 1;
    }
  }

  const totalTaskCount = Object.keys(nodeStates).length;

  const remainingBlockingNodes = uniqueSorted([
    ...(input.taskExecutionProjection?.blockingNodes ?? []),
    ...(input.taskOrchestrationProjection?.deferredNodes ?? []).map((entry) => entry.taskNodeId),
  ]);

  let criticalPathState: MissionProgressSummary['criticalPathState'] = 'inconclusive';
  if (totalTaskCount > 0 && completedTaskCount === totalTaskCount) {
    criticalPathState = 'clear';
  } else if (failedTaskCount > 0) {
    criticalPathState = 'failed';
  } else if (blockedTaskCount > 0 || remainingBlockingNodes.length > 0) {
    criticalPathState = 'blocked';
  } else if (runningTaskCount > 0 || retryingTaskCount > 0 || readyTaskCount > 0) {
    criticalPathState = 'constrained';
  }

  return {
    totalTaskCount,
    pendingTaskCount,
    readyTaskCount,
    runningTaskCount,
    retryingTaskCount,
    completedTaskCount,
    failedTaskCount,
    blockedTaskCount,
    skippedTaskCount,
    completionPercent: toPercent(completedTaskCount, totalTaskCount),
    criticalPathState,
    remainingBlockingNodes,
  };
}
