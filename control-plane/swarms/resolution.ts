import type { ExecutionMode, SwarmDefinition } from './types.ts';

export type SwarmResolutionResult = {
  swarmsTouched: string[];
  swarmExecutionModesTouched: ExecutionMode[];
};

function sortedUnique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b)) as T[];
}

export function resolveSwarmsForProjects(projectsTouched: string[], swarms: SwarmDefinition[]): SwarmResolutionResult {
  const projectSet = new Set(projectsTouched);
  const swarmsTouched = swarms
    .filter((swarm) => projectSet.has(swarm.project))
    .map((swarm) => swarm.swarmId);

  const modesTouched = swarms
    .filter((swarm) => projectSet.has(swarm.project))
    .map((swarm) => swarm.executionMode);

  return {
    swarmsTouched: sortedUnique(swarmsTouched),
    swarmExecutionModesTouched: sortedUnique(modesTouched)
  };
}
