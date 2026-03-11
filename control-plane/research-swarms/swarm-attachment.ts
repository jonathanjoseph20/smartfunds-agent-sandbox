import { createSwarmRegistry, type SwarmRegistry } from './swarm-registry.ts';
import { SwarmError, type SwarmDefinition } from './swarm-types.ts';

export function createSwarmAttachment(options: {
  registry?: SwarmRegistry;
  definitionsDir?: string;
} = {}) {
  const registry = options.registry ?? createSwarmRegistry({ definitionsDir: options.definitionsDir });

  function getSwarmsForTeam(teamId: string): SwarmDefinition[] {
    return registry
      .listSwarmDefinitions()
      .filter((definition) => definition.teamId === teamId)
      .sort((left, right) => left.swarmId.localeCompare(right.swarmId));
  }

  function getSwarmTeam(swarmId: string): string {
    const definition = registry.getSwarmDefinition(swarmId);
    return definition.teamId;
  }

  return {
    getSwarmsForTeam,
    getSwarmTeam
  };
}

export type SwarmAttachment = ReturnType<typeof createSwarmAttachment>;

export function getSwarmsForTeam(teamId: string, options: { definitionsDir?: string } = {}): SwarmDefinition[] {
  return createSwarmAttachment(options).getSwarmsForTeam(teamId);
}

export function getSwarmTeam(swarmId: string, options: { definitionsDir?: string } = {}): string {
  try {
    return createSwarmAttachment(options).getSwarmTeam(swarmId);
  } catch (error) {
    throw new SwarmError('SWARM_NOT_FOUND', (error as Error).message);
  }
}
