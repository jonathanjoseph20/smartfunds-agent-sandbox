import type { MissionTaskGraph } from '../task-graph/task-graph-types.ts';

import type { TaskExecutionNodeState } from './task-execution-step-types.ts';

export type MissionTaskRetryScheduleEntry = {
  taskNodeId: string;
  attemptIndex: number;
  dependencySatisfied: boolean;
};

function predecessorsByNode(taskGraph: MissionTaskGraph): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const node of taskGraph.taskNodes) {
    map.set(node.taskNodeId, []);
  }

  for (const edge of taskGraph.taskEdges) {
    if (edge.dependencyType !== 'finish_to_start') {
      continue;
    }

    const current = map.get(edge.targetNodeId) ?? [];
    current.push(edge.sourceNodeId);
    current.sort((left, right) => left.localeCompare(right));
    map.set(edge.targetNodeId, current);
  }

  return map;
}

export function dependenciesSatisfiedForTaskRetry(input: {
  taskGraph: MissionTaskGraph;
  taskNodeId: string;
  nodeStates: Record<string, TaskExecutionNodeState>;
}): boolean {
  const predecessors = predecessorsByNode(input.taskGraph).get(input.taskNodeId) ?? [];
  return predecessors.every((predecessorId) => input.nodeStates[predecessorId] === 'completed');
}

export function sortTaskRetrySchedule(entries: MissionTaskRetryScheduleEntry[]): MissionTaskRetryScheduleEntry[] {
  return [...entries].sort((left, right) => {
    const byDependency = Number(right.dependencySatisfied) - Number(left.dependencySatisfied);
    if (byDependency !== 0) {
      return byDependency;
    }

    const byRetryOrder = left.attemptIndex - right.attemptIndex;
    if (byRetryOrder !== 0) {
      return byRetryOrder;
    }

    return left.taskNodeId.localeCompare(right.taskNodeId);
  });
}

export function scheduleTaskRetry(input: {
  queue: MissionTaskRetryScheduleEntry[];
  taskNodeId: string;
  attemptIndex: number;
  dependencySatisfied: boolean;
}): MissionTaskRetryScheduleEntry[] {
  const deduped = input.queue.filter((entry) => !(entry.taskNodeId === input.taskNodeId && entry.attemptIndex === input.attemptIndex));

  return sortTaskRetrySchedule([
    ...deduped,
    {
      taskNodeId: input.taskNodeId,
      attemptIndex: input.attemptIndex,
      dependencySatisfied: input.dependencySatisfied,
    },
  ]);
}
