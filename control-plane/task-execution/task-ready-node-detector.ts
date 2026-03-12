import type { MissionTaskGraph } from '../task-graph/task-graph-types.ts';

import type { TaskExecutionNodeState } from './task-execution-step-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function buildPredecessors(taskGraph: MissionTaskGraph): Map<string, string[]> {
  const predecessors = new Map<string, string[]>();

  for (const node of [...taskGraph.taskNodes].sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))) {
    predecessors.set(node.taskNodeId, []);
  }

  for (const edge of [...taskGraph.taskEdges].sort((left, right) => {
    const bySource = left.sourceNodeId.localeCompare(right.sourceNodeId);
    if (bySource !== 0) {
      return bySource;
    }
    const byTarget = left.targetNodeId.localeCompare(right.targetNodeId);
    if (byTarget !== 0) {
      return byTarget;
    }
    return left.dependencyType.localeCompare(right.dependencyType);
  })) {
    if (edge.dependencyType !== 'finish_to_start') {
      continue;
    }

    const next = predecessors.get(edge.targetNodeId) ?? [];
    next.push(edge.sourceNodeId);
    predecessors.set(edge.targetNodeId, uniqueSorted(next));
  }

  return predecessors;
}

export function deriveTaskGraphTopologicalOrder(taskGraph: MissionTaskGraph): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of [...taskGraph.taskNodes].sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))) {
    inDegree.set(node.taskNodeId, 0);
    adjacency.set(node.taskNodeId, []);
  }

  for (const edge of [...taskGraph.taskEdges].sort((left, right) => {
    const bySource = left.sourceNodeId.localeCompare(right.sourceNodeId);
    if (bySource !== 0) {
      return bySource;
    }
    const byTarget = left.targetNodeId.localeCompare(right.targetNodeId);
    if (byTarget !== 0) {
      return byTarget;
    }
    return left.dependencyType.localeCompare(right.dependencyType);
  })) {
    if (edge.dependencyType !== 'finish_to_start') {
      continue;
    }

    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
    const outgoing = adjacency.get(edge.sourceNodeId) ?? [];
    outgoing.push(edge.targetNodeId);
    adjacency.set(edge.sourceNodeId, uniqueSorted(outgoing));
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([nodeId]) => nodeId)
    .sort((left, right) => left.localeCompare(right));

  const order: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      continue;
    }

    order.push(nodeId);

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        queue.push(neighbor);
        queue.sort((left, right) => left.localeCompare(right));
      }
    }
  }

  if (order.length !== taskGraph.taskNodes.length) {
    const remaining = [...inDegree.entries()]
      .filter(([, degree]) => degree > 0)
      .map(([nodeId]) => nodeId)
      .sort((left, right) => left.localeCompare(right));
    throw new Error(`TASK_EXECUTION_STEP_INVALID:${remaining.join(',')}`);
  }

  return order;
}

export function detectReadyTaskNodeIds(input: {
  taskGraph: MissionTaskGraph;
  nodeStates: Record<string, TaskExecutionNodeState>;
}): string[] {
  const predecessors = buildPredecessors(input.taskGraph);
  const order = deriveTaskGraphTopologicalOrder(input.taskGraph);
  const orderIndex = new Map(order.map((nodeId, index) => [nodeId, index]));

  const ready = input.taskGraph.taskNodes
    .filter((node) => {
      const nodeState = input.nodeStates[node.taskNodeId];
      if (nodeState !== 'pending') {
        return false;
      }

      const nodePredecessors = predecessors.get(node.taskNodeId) ?? [];
      return nodePredecessors.every((predecessorId) => input.nodeStates[predecessorId] === 'completed');
    })
    .map((node) => node.taskNodeId)
    .sort((left, right) => {
      const leftIndex = orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER;
      const byOrder = leftIndex - rightIndex;
      if (byOrder !== 0) {
        return byOrder;
      }
      return left.localeCompare(right);
    });

  return ready;
}
