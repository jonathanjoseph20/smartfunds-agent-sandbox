import { phaseIndex, type OrchestrationRegistryV1, type OrchestrationSwarmV1 } from './orchestration-schema.ts';

export type SwarmDependencyEdge = {
  from: string;
  to: string;
};

export type OrchestrationGraphResult = {
  edges: SwarmDependencyEdge[];
  topologicalOrder: string[];
  phaseBySwarm: Record<string, string>;
  allowsCrossModeDepsBySwarm: Record<string, boolean>;
  graphViolations: string[];
  phaseViolations: string[];
  cycleDetected?: string[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function sortEdges(edges: SwarmDependencyEdge[]): SwarmDependencyEdge[] {
  return [...edges].sort((left, right) => {
    const from = left.from.localeCompare(right.from);
    if (from !== 0) {
      return from;
    }
    return left.to.localeCompare(right.to);
  });
}

function sortRecordByKey<T>(value: Record<string, T>): Record<string, T> {
  const sortedEntries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(sortedEntries) as Record<string, T>;
}

function canonicalizeCycle(cycle: string[]): string[] {
  if (cycle.length === 0) {
    return cycle;
  }
  let minIndex = 0;
  for (let index = 1; index < cycle.length; index += 1) {
    if (cycle[index].localeCompare(cycle[minIndex]) < 0) {
      minIndex = index;
    }
  }
  return [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
}

function detectCycle(nodeIds: string[], adjacency: Map<string, string[]>): string[] | undefined {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const indexByNode = new Map<string, number>();
  let cycle: string[] | undefined;

  const visit = (nodeId: string): void => {
    if (cycle || visited.has(nodeId)) {
      return;
    }

    visiting.add(nodeId);
    indexByNode.set(nodeId, stack.length);
    stack.push(nodeId);

    const neighbors = adjacency.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (cycle) {
        return;
      }
      if (visiting.has(neighbor)) {
        const cycleStart = indexByNode.get(neighbor) ?? 0;
        cycle = canonicalizeCycle(stack.slice(cycleStart));
        return;
      }
      if (!visited.has(neighbor)) {
        visit(neighbor);
      }
    }

    stack.pop();
    indexByNode.delete(nodeId);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      visit(nodeId);
    }
    if (cycle) {
      return cycle;
    }
  }
  return undefined;
}

function topologicalSort(nodeIds: string[], adjacency: Map<string, string[]>): { order: string[]; hasCycle: boolean } {
  const inDegree = new Map<string, number>(nodeIds.map((nodeId) => [nodeId, 0]));

  for (const nodeId of nodeIds) {
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) + 1);
    }
  }

  const available = nodeIds.filter((nodeId) => (inDegree.get(nodeId) ?? 0) === 0).sort((a, b) => a.localeCompare(b));
  const order: string[] = [];

  while (available.length > 0) {
    const next = available.shift();
    if (!next) {
      break;
    }
    order.push(next);
    for (const neighbor of adjacency.get(next) ?? []) {
      const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        available.push(neighbor);
      }
    }
    available.sort((a, b) => a.localeCompare(b));
  }

  return {
    order,
    hasCycle: order.length !== nodeIds.length
  };
}

function toPhaseBySwarm(swarms: OrchestrationSwarmV1[]): Record<string, string> {
  const phaseBySwarm: Record<string, string> = {};
  for (const swarm of swarms) {
    phaseBySwarm[swarm.swarmId] = swarm.phase;
  }
  return sortRecordByKey(phaseBySwarm);
}

function toAllowsCrossModeDepsBySwarm(swarms: OrchestrationSwarmV1[]): Record<string, boolean> {
  const allowsBySwarm: Record<string, boolean> = {};
  for (const swarm of swarms) {
    allowsBySwarm[swarm.swarmId] = swarm.allowsCrossModeDeps === true;
  }
  return sortRecordByKey(allowsBySwarm);
}

export function buildOrchestrationGraph(
  registry: OrchestrationRegistryV1,
  baseSwarmIds: string[]
): OrchestrationGraphResult {
  const sortedSwarms = [...registry.swarms].sort((a, b) => a.swarmId.localeCompare(b.swarmId));
  const nodeIds = sortedSwarms.map((swarm) => swarm.swarmId);
  const nodeSet = new Set(nodeIds);
  const baseSwarmSet = new Set(baseSwarmIds);

  const graphViolations: string[] = [];
  const rawEdges: SwarmDependencyEdge[] = [];
  const rawEdgeKeys = new Set<string>();

  for (const swarm of sortedSwarms) {
    if (!baseSwarmSet.has(swarm.swarmId)) {
      graphViolations.push(`orchestration.unknown_swarm: swarmId=${swarm.swarmId}`);
    }

    const dependencySeen = new Set<string>();
    const dependencies = [...swarm.dependsOn].sort((a, b) => a.localeCompare(b));
    for (const dependency of dependencies) {
      if (dependencySeen.has(dependency)) {
        graphViolations.push(`orchestration.dependsOn_duplicates: swarmId=${swarm.swarmId} dep=${dependency}`);
        continue;
      }
      dependencySeen.add(dependency);

      if (!nodeSet.has(dependency) || !baseSwarmSet.has(dependency)) {
        graphViolations.push(`orchestration.unknown_dependency: from=${swarm.swarmId} dependsOn=${dependency}`);
        continue;
      }

      const edgeKey = `${dependency}\u0000${swarm.swarmId}`;
      if (!rawEdgeKeys.has(edgeKey)) {
        rawEdgeKeys.add(edgeKey);
        rawEdges.push({ from: dependency, to: swarm.swarmId });
      }
    }
  }

  const edges = sortEdges(rawEdges);
  const adjacency = new Map<string, string[]>(nodeIds.map((nodeId) => [nodeId, []]));
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from) ?? [];
    neighbors.push(edge.to);
    neighbors.sort((a, b) => a.localeCompare(b));
    adjacency.set(edge.from, neighbors);
  }

  const topoResult = topologicalSort(nodeIds, adjacency);
  let cycleDetected: string[] | undefined;
  if (topoResult.hasCycle) {
    cycleDetected = detectCycle(nodeIds, adjacency) ?? [];
    graphViolations.push(`orchestration.cycle_detected: cycle=${cycleDetected.join('->')}`);
  }

  const phaseBySwarm = toPhaseBySwarm(sortedSwarms);
  const phaseViolations: string[] = [];
  for (const edge of edges) {
    const phaseA = phaseBySwarm[edge.from];
    const phaseB = phaseBySwarm[edge.to];
    if (phaseA === undefined || phaseB === undefined) {
      continue;
    }
    if (phaseIndex(phaseA as OrchestrationSwarmV1['phase']) > phaseIndex(phaseB as OrchestrationSwarmV1['phase'])) {
      phaseViolations.push(
        `orchestration.phase_order_violation: dependency=${edge.from} phase=${phaseA} dependent=${edge.to} phase=${phaseB}`
      );
    }
  }

  return {
    edges,
    topologicalOrder: topoResult.hasCycle ? [] : topoResult.order,
    phaseBySwarm,
    allowsCrossModeDepsBySwarm: toAllowsCrossModeDepsBySwarm(sortedSwarms),
    graphViolations: sortedUnique(graphViolations),
    phaseViolations: sortedUnique(phaseViolations),
    ...(cycleDetected && cycleDetected.length > 0 ? { cycleDetected } : {})
  };
}
