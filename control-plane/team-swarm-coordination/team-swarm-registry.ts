import { createSwarmAttachment, type SwarmAttachment } from '../research-swarms/swarm-attachment.ts';
import { createResearchTeamRegistry, type ResearchTeamRegistry } from '../research-teams/research-team-registry.ts';

import type { TeamSwarmRegistryRecord } from './team-swarm-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function createTeamSwarmRegistry(options: {
  teamRegistry?: ResearchTeamRegistry;
  swarmAttachment?: SwarmAttachment;
  teamDefinitionsDir?: string;
  swarmDefinitionsDir?: string;
} = {}) {
  const teamRegistry = options.teamRegistry ?? createResearchTeamRegistry({ definitionsDir: options.teamDefinitionsDir });
  const swarmAttachment = options.swarmAttachment ?? createSwarmAttachment({
    definitionsDir: options.swarmDefinitionsDir
  });

  function listTeamIds(): string[] {
    return teamRegistry
      .listResearchTeams()
      .map((team) => team.teamId)
      .sort((left, right) => left.localeCompare(right));
  }

  function listByTeam(teamId: string): TeamSwarmRegistryRecord[] {
    const team = teamRegistry.getResearchTeam(teamId);
    const swarms = swarmAttachment.getSwarmsForTeam(teamId);

    return swarms
      .map((swarm) => ({
        teamId,
        teamDisplayName: team.displayName,
        teamEnabled: team.enabled,
        swarmId: swarm.swarmId,
        swarmDisplayName: swarm.displayName,
        investigationTemplates: uniqueSorted(swarm.investigationTemplates)
      }))
      .sort((left, right) => left.swarmId.localeCompare(right.swarmId));
  }

  function listAll(): TeamSwarmRegistryRecord[] {
    return listTeamIds()
      .flatMap((teamId) => listByTeam(teamId))
      .sort((left, right) => {
        const teamCmp = left.teamId.localeCompare(right.teamId);
        if (teamCmp !== 0) {
          return teamCmp;
        }
        return left.swarmId.localeCompare(right.swarmId);
      });
  }

  function listTeamsWithSwarms(): Array<{ teamId: string; teamDisplayName: string; teamEnabled: boolean; swarmCount: number }> {
    return listTeamIds()
      .map((teamId) => {
        const linked = listByTeam(teamId);
        return {
          teamId,
          teamDisplayName: linked[0]?.teamDisplayName ?? teamRegistry.getResearchTeam(teamId).displayName,
          teamEnabled: linked[0]?.teamEnabled ?? teamRegistry.getResearchTeam(teamId).enabled,
          swarmCount: linked.length
        };
      })
      .filter((entry) => entry.swarmCount > 0)
      .sort((left, right) => left.teamId.localeCompare(right.teamId));
  }

  return {
    listByTeam,
    listAll,
    listTeamIds,
    listTeamsWithSwarms
  };
}

export type TeamSwarmRegistry = ReturnType<typeof createTeamSwarmRegistry>;
