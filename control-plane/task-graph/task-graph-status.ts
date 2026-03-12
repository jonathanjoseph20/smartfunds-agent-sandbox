import type {
  MissionTaskGraphHistoryEntry,
  MissionTaskNode,
  TaskGraphEligibilityState,
  TaskGraphState,
} from './task-graph-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasEvent(entries: MissionTaskGraphHistoryEntry[] | undefined, eventType: string): boolean {
  if (!entries) {
    return false;
  }

  return entries.some((entry) => entry.eventType === eventType);
}

export function deriveTaskGraphStatus(input: {
  taskNodes: MissionTaskNode[];
  historyEntries?: MissionTaskGraphHistoryEntry[];
}) {
  const pendingNodeCount = input.taskNodes.filter((node) => node.taskState === 'pending').length;
  const readyNodeCount = input.taskNodes.filter((node) => node.taskState === 'ready').length;
  const runningNodeCount = input.taskNodes.filter((node) => node.taskState === 'running').length;
  const completedNodeCount = input.taskNodes.filter((node) => node.taskState === 'completed').length;
  const failedNodeCount = input.taskNodes.filter((node) => node.taskState === 'failed').length;
  const blockedNodeCount = input.taskNodes.filter((node) => node.taskState === 'blocked').length;
  const pendingWithBlockingReasons = input.taskNodes.some((node) => node.taskState === 'pending' && node.blockingReasons.length > 0);

  const allNodesCompleted = input.taskNodes.length > 0 && completedNodeCount === input.taskNodes.length;

  let graphState: TaskGraphState = 'initialized';
  if (readyNodeCount > 0) {
    graphState = 'ready_for_execution';
  }
  if (runningNodeCount > 0) {
    graphState = 'running';
  }
  if (blockedNodeCount > 0 || failedNodeCount > 0) {
    graphState = 'blocked';
  }
  if (allNodesCompleted) {
    graphState = 'completed';
  }
  if (pendingWithBlockingReasons && readyNodeCount === 0 && runningNodeCount === 0 && !allNodesCompleted) {
    graphState = 'blocked';
  }
  if (
    pendingNodeCount > 0
    && readyNodeCount === 0
    && runningNodeCount === 0
    && !allNodesCompleted
    && blockedNodeCount === 0
    && failedNodeCount === 0
    && !pendingWithBlockingReasons
  ) {
    graphState = 'evaluated';
  }

  if (hasEvent(input.historyEntries, 'graph_completed')) {
    graphState = 'completed';
  }
  if (hasEvent(input.historyEntries, 'graph_blocked')) {
    graphState = 'blocked';
  }

  let graphEligibilityState: TaskGraphEligibilityState = 'eligible';
  if (graphState === 'blocked') {
    graphEligibilityState = 'blocked';
  } else if (graphState === 'initialized' || graphState === 'evaluated') {
    graphEligibilityState = 'waiting_on_dependencies';
  }

  const blockingReasons = uniqueSorted(input.taskNodes
    .filter((node) => node.taskState === 'blocked' || node.taskState === 'failed' || node.blockingReasons.length > 0)
    .flatMap((node) => node.blockingReasons));

  return {
    graphState,
    graphEligibilityState,
    readyNodeCount,
    runningNodeCount,
    completedNodeCount,
    blockedNodeCount,
    nodeStateCounts: {
      pending: pendingNodeCount,
      ready: readyNodeCount,
      running: runningNodeCount,
      completed: completedNodeCount,
      failed: failedNodeCount,
      blocked: blockedNodeCount,
      skipped: input.taskNodes.filter((node) => node.taskState === 'skipped').length,
    },
    blockingReasons,
  };
}
