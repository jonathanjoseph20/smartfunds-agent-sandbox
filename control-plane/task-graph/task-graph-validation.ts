import {
  TASK_EDGE_DEPENDENCY_TYPES,
  type MissionTaskEdge,
  type MissionTaskNode,
} from './task-graph-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function buildAdjacency(nodes: MissionTaskNode[], edges: MissionTaskEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>(nodes.map((node) => [node.taskNodeId, []]));

  for (const edge of edges) {
    const current = adjacency.get(edge.sourceNodeId) ?? [];
    current.push(edge.targetNodeId);
    current.sort((left, right) => left.localeCompare(right));
    adjacency.set(edge.sourceNodeId, current);
  }

  return adjacency;
}

function buildInDegree(nodes: MissionTaskNode[], edges: MissionTaskEdge[]): Map<string, number> {
  const inDegree = new Map<string, number>(nodes.map((node) => [node.taskNodeId, 0]));

  for (const edge of edges) {
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
  }

  return inDegree;
}

function detectCycle(nodes: MissionTaskNode[], edges: MissionTaskEdge[]): void {
  const nodeIds = nodes.map((node) => node.taskNodeId).sort((left, right) => left.localeCompare(right));
  const inDegree = buildInDegree(nodes, edges);
  const adjacency = buildAdjacency(nodes, edges);

  const queue = nodeIds.filter((nodeId) => (inDegree.get(nodeId) ?? 0) === 0);
  const visited: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    visited.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        queue.push(neighbor);
        queue.sort((left, right) => left.localeCompare(right));
      }
    }
  }

  if (visited.length !== nodeIds.length) {
    const cycleNodes = nodeIds
      .filter((nodeId) => (inDegree.get(nodeId) ?? 0) > 0)
      .sort((left, right) => left.localeCompare(right));
    throw new Error(`TASK_GRAPH_CYCLE_DETECTED: ${cycleNodes.join(',')}`);
  }
}

function validateConnectivity(nodes: MissionTaskNode[], edges: MissionTaskEdge[]): void {
  if (nodes.length === 0) {
    throw new Error('TASK_GRAPH_EMPTY');
  }

  const undirected = new Map<string, string[]>(nodes.map((node) => [node.taskNodeId, []]));

  for (const edge of edges) {
    const left = undirected.get(edge.sourceNodeId) ?? [];
    left.push(edge.targetNodeId);
    left.sort((a, b) => a.localeCompare(b));
    undirected.set(edge.sourceNodeId, left);

    const right = undirected.get(edge.targetNodeId) ?? [];
    right.push(edge.sourceNodeId);
    right.sort((a, b) => a.localeCompare(b));
    undirected.set(edge.targetNodeId, right);
  }

  const start = [...undirected.keys()].sort((a, b) => a.localeCompare(b))[0];
  if (!start) {
    throw new Error('TASK_GRAPH_EMPTY');
  }

  const visited = new Set<string>();
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);

    for (const next of undirected.get(current) ?? []) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }

    queue.sort((a, b) => a.localeCompare(b));
  }

  if (visited.size !== nodes.length) {
    const disconnected = nodes
      .map((node) => node.taskNodeId)
      .filter((nodeId) => !visited.has(nodeId))
      .sort((left, right) => left.localeCompare(right));
    throw new Error(`TASK_GRAPH_DISCONNECTED: ${disconnected.join(',')}`);
  }
}

export function validateTaskGraph(input: {
  taskGraphId: string;
  taskNodes: MissionTaskNode[];
  taskEdges: MissionTaskEdge[];
}) {
  if (!input.taskGraphId || input.taskGraphId.trim().length === 0) {
    throw new Error('TASK_GRAPH_INVALID_ID');
  }

  const taskNodes = [...input.taskNodes].sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId));
  const taskEdges = [...input.taskEdges].sort((left, right) => {
    const bySource = left.sourceNodeId.localeCompare(right.sourceNodeId);
    if (bySource !== 0) {
      return bySource;
    }
    const byTarget = left.targetNodeId.localeCompare(right.targetNodeId);
    if (byTarget !== 0) {
      return byTarget;
    }
    return left.dependencyType.localeCompare(right.dependencyType);
  });

  if (taskNodes.length === 0) {
    throw new Error('TASK_GRAPH_EMPTY');
  }

  const nodeIdSet = new Set(taskNodes.map((node) => node.taskNodeId));

  if (nodeIdSet.size !== taskNodes.length) {
    throw new Error('TASK_GRAPH_DUPLICATE_NODE_ID');
  }

  for (const node of taskNodes) {
    if (node.taskGraphId !== input.taskGraphId) {
      throw new Error(`TASK_GRAPH_INVALID_NODE_REFERENCE: ${node.taskNodeId}`);
    }
  }

  const edgeKeys: string[] = [];
  for (const edge of taskEdges) {
    if (edge.taskGraphId !== input.taskGraphId) {
      throw new Error(`TASK_GRAPH_INVALID_EDGE_REFERENCE: ${edge.taskEdgeId}`);
    }

    if (!TASK_EDGE_DEPENDENCY_TYPES.includes(edge.dependencyType)) {
      throw new Error(`TASK_GRAPH_INVALID_DEPENDENCY_TYPE: ${edge.dependencyType}`);
    }

    if (!nodeIdSet.has(edge.sourceNodeId) || !nodeIdSet.has(edge.targetNodeId)) {
      throw new Error(`TASK_GRAPH_INVALID_NODE_REFERENCE: ${edge.sourceNodeId}->${edge.targetNodeId}`);
    }

    if (edge.sourceNodeId === edge.targetNodeId) {
      throw new Error(`TASK_GRAPH_SELF_DEPENDENCY: ${edge.sourceNodeId}`);
    }

    edgeKeys.push(`${edge.sourceNodeId}->${edge.targetNodeId}:${edge.dependencyType}`);
  }

  if (uniqueSorted(edgeKeys).length !== edgeKeys.length) {
    throw new Error('TASK_GRAPH_DUPLICATE_EDGE');
  }

  validateConnectivity(taskNodes, taskEdges);
  detectCycle(taskNodes, taskEdges);

  return {
    taskNodes,
    taskEdges,
  };
}
