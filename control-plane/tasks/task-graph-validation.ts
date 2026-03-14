import type {
  ImplementationTaskGraphValidation,
  ImplementationTaskGraph,
} from './task-graph-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function detectCycle(graph: ImplementationTaskGraph): boolean {
  const nodeIds = graph.taskNodes.map((node) => node.taskNodeId).sort((left, right) => left.localeCompare(right));
  const inDegree = new Map<string, number>(nodeIds.map((nodeId) => [nodeId, 0]));
  const adjacency = new Map<string, string[]>(nodeIds.map((nodeId) => [nodeId, []]));

  for (const edge of graph.taskEdges) {
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
    const row = adjacency.get(edge.sourceNodeId) ?? [];
    row.push(edge.targetNodeId);
    row.sort((left, right) => left.localeCompare(right));
    adjacency.set(edge.sourceNodeId, row);
  }

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

  return visited.length !== nodeIds.length;
}

export function validateImplementationTaskGraph(graph: ImplementationTaskGraph): ImplementationTaskGraphValidation {
  const constraintViolations: string[] = [];

  if (!graph.taskGraphId.trim()) {
    constraintViolations.push('invalid_graph_id');
  }

  if (graph.taskNodes.length === 0) {
    constraintViolations.push('empty_task_nodes');
  }

  if (graph.taskNodes.length !== graph.nodeCount) {
    constraintViolations.push('node_count_mismatch');
  }

  if (graph.taskEdges.length !== graph.edgeCount) {
    constraintViolations.push('edge_count_mismatch');
  }

  const nodeIdSet = new Set(graph.taskNodes.map((node) => node.taskNodeId));
  if (nodeIdSet.size !== graph.taskNodes.length) {
    constraintViolations.push('duplicate_task_node_id');
  }

  for (const node of graph.taskNodes) {
    if (node.taskGraphId !== graph.taskGraphId) {
      constraintViolations.push('node_graph_reference_mismatch');
    }
  }

  const edgeKeys = new Set<string>();

  for (const edge of graph.taskEdges) {
    if (edge.taskGraphId !== graph.taskGraphId) {
      constraintViolations.push('edge_graph_reference_mismatch');
    }

    if (edge.dependencyType !== 'finish_to_start') {
      constraintViolations.push('invalid_edge_dependency_type');
    }

    if (!nodeIdSet.has(edge.sourceNodeId) || !nodeIdSet.has(edge.targetNodeId)) {
      constraintViolations.push('edge_node_reference_missing');
    }

    if (edge.sourceNodeId === edge.targetNodeId) {
      constraintViolations.push('self_edge_dependency');
    }

    const key = `${edge.sourceNodeId}->${edge.targetNodeId}:${edge.dependencyType}`;
    if (edgeKeys.has(key)) {
      constraintViolations.push('duplicate_edge');
    }
    edgeKeys.add(key);
  }

  if (detectCycle(graph)) {
    constraintViolations.push('cycle_detected');
  }

  const sortedViolations = uniqueSorted(constraintViolations);

  return {
    validationState: sortedViolations.length > 0 ? 'invalid' : 'valid',
    constraintViolations: sortedViolations,
  };
}
