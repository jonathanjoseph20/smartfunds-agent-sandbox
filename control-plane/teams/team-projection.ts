import type { TeamProjection } from './team-definition-types.ts';
import { createTeamHistoryStore, type TeamHistoryStore } from './team-history-store.ts';
import { createTeamRegistry, type TeamRegistry } from './team-registry.ts';
import { evaluateTeamStatus } from './team-status.ts';
import {
  buildTeamValidatorReferenceContext,
  validateTeamRegistryDefinition,
} from './team-validator.ts';

export function createTeamProjection(options: {
  registry?: TeamRegistry;
  historyStore?: TeamHistoryStore;
  definitionsDir?: string;
} = {}) {
  const registry = options.registry ?? createTeamRegistry({ definitionsDir: options.definitionsDir });
  const historyStore = options.historyStore ?? createTeamHistoryStore();
  const referenceContext = buildTeamValidatorReferenceContext();

  function projectOne(teamId: string): TeamProjection {
    const definition = registry.getTeam(teamId);
    const validation = validateTeamRegistryDefinition(definition, referenceContext, teamId);
    const status = evaluateTeamStatus({
      definition,
      validationIssues: validation.issues,
    });

    return {
      teamId: definition.teamId,
      definition,
      validation,
      status,
      history: historyStore.load(definition),
      summary: {
        teamId: definition.teamId,
        displayName: definition.displayName,
        teamType: definition.teamType,
        defaultOperatingMode: definition.defaultOperatingMode,
        lifecycleState: status.lifecycleState,
        availabilityState: status.availabilityState,
        readinessState: status.readinessState,
      },
    };
  }

  function projectAll(): TeamProjection[] {
    return registry
      .listTeams()
      .map((definition) => projectOne(definition.teamId))
      .sort((left, right) => left.teamId.localeCompare(right.teamId));
  }

  return {
    projectOne,
    projectAll,
  };
}

export type TeamProjectionEngine = ReturnType<typeof createTeamProjection>;
