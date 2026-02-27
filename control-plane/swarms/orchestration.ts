import type { SwarmDefinition } from './types.ts';
import { evaluateCrossModeDependencyPolicy } from './orchestration-compat.ts';
import { buildOrchestrationGraph, type SwarmDependencyEdge } from './orchestration-graph.ts';
import type { OrchestrationRegistryV1 } from './orchestration-schema.ts';
import { loadOrchestrationRegistryFromFile } from './orchestration-registry.ts';

export type SwarmOrchestrationStatus = 'ok' | 'missing_registry' | 'invalid_graph' | 'violations';

export type SwarmOrchestrationResult = {
  status: SwarmOrchestrationStatus;
  violations: string[];
  edges: SwarmDependencyEdge[];
  topologicalOrder: string[];
  phaseBySwarm: Record<string, string>;
  cycleDetected?: string[];
};

const ORCHESTRATION_REGISTRY_PATH = 'control-plane/swarms/orchestration.json';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function sortRecordByKey<T>(value: Record<string, T>): Record<string, T> {
  const sortedEntries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(sortedEntries) as Record<string, T>;
}

export function evaluateSwarmOrchestrationContracts(params: {
  swarms: SwarmDefinition[];
  registry: OrchestrationRegistryV1;
}): SwarmOrchestrationResult {
  const baseSwarmIds = params.swarms.map((swarm) => swarm.swarmId).sort((a, b) => a.localeCompare(b));
  const executionModeBySwarm = sortRecordByKey(
    Object.fromEntries(params.swarms.map((swarm) => [swarm.swarmId, swarm.executionMode]))
  );

  const graph = buildOrchestrationGraph(params.registry, baseSwarmIds);
  const compatibilityViolations = evaluateCrossModeDependencyPolicy({
    edges: graph.edges,
    executionModeBySwarm,
    allowsCrossModeDepsBySwarm: graph.allowsCrossModeDepsBySwarm
  });

  const graphViolations = sortedUnique(graph.graphViolations);
  const ruleViolations = sortedUnique([...graph.phaseViolations, ...compatibilityViolations]);

  if (graphViolations.length > 0) {
    return {
      status: 'invalid_graph',
      violations: graphViolations,
      edges: graph.edges,
      topologicalOrder: graph.topologicalOrder,
      phaseBySwarm: graph.phaseBySwarm,
      ...(graph.cycleDetected && graph.cycleDetected.length > 0 ? { cycleDetected: graph.cycleDetected } : {})
    };
  }

  return {
    status: ruleViolations.length > 0 ? 'violations' : 'ok',
    violations: ruleViolations,
    edges: graph.edges,
    topologicalOrder: graph.topologicalOrder,
    phaseBySwarm: graph.phaseBySwarm,
    ...(graph.cycleDetected && graph.cycleDetected.length > 0 ? { cycleDetected: graph.cycleDetected } : {})
  };
}

export function evaluateSwarmOrchestration(params: {
  swarmsTouched: string[];
  swarms: SwarmDefinition[];
  registryPath?: string;
}): SwarmOrchestrationResult {
  const swarmsTouched = sortedUnique(params.swarmsTouched);
  if (swarmsTouched.length === 0) {
    return {
      status: 'ok',
      violations: [],
      edges: [],
      topologicalOrder: [],
      phaseBySwarm: {}
    };
  }

  const registryPath = params.registryPath ?? ORCHESTRATION_REGISTRY_PATH;
  const registryResult = loadOrchestrationRegistryFromFile(registryPath);
  if (registryResult.status === 'missing_registry') {
    return {
      status: 'missing_registry',
      violations: registryResult.errors,
      edges: [],
      topologicalOrder: [],
      phaseBySwarm: {}
    };
  }
  if (registryResult.status === 'invalid_registry') {
    return {
      status: 'invalid_graph',
      violations: registryResult.errors,
      edges: [],
      topologicalOrder: [],
      phaseBySwarm: {}
    };
  }

  return evaluateSwarmOrchestrationContracts({
    swarms: params.swarms,
    registry: registryResult.registry
  });
}
