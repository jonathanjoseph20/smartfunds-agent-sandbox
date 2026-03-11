import { createSwarmRegistry, type SwarmRegistry } from './swarm-registry.ts';

export interface SwarmRoutableInvestigation {
  investigationRunId: string;
  investigationDefinitionId: string;
  status: string;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function createSwarmInvestigationRouting(options: {
  registry?: SwarmRegistry;
  definitionsDir?: string;
} = {}) {
  const registry = options.registry ?? createSwarmRegistry({ definitionsDir: options.definitionsDir });

  function routeInvestigationToSwarm(investigation: Pick<SwarmRoutableInvestigation, 'investigationDefinitionId'>): string | null {
    const matches = registry
      .listSwarmDefinitions()
      .filter((definition) => definition.investigationTemplates.includes(investigation.investigationDefinitionId))
      .map((definition) => definition.swarmId)
      .sort((left, right) => left.localeCompare(right));

    return matches[0] ?? null;
  }

  function getSwarmInvestigations(swarmId: string, investigations: SwarmRoutableInvestigation[]): SwarmRoutableInvestigation[] {
    const definition = registry.getSwarmDefinition(swarmId);

    return investigations
      .filter((investigation) => definition.investigationTemplates.includes(investigation.investigationDefinitionId))
      .map((investigation) => ({ ...investigation }))
      .sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));
  }

  function listInvestigationTemplatesForSwarm(swarmId: string): string[] {
    const definition = registry.getSwarmDefinition(swarmId);
    return uniqueSorted(definition.investigationTemplates);
  }

  return {
    getSwarmInvestigations,
    routeInvestigationToSwarm,
    listInvestigationTemplatesForSwarm
  };
}

export type SwarmInvestigationRouting = ReturnType<typeof createSwarmInvestigationRouting>;
