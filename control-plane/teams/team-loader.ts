import fs from 'node:fs';
import path from 'node:path';

import type { AgentProfileDefinition } from '../agents/agent-profile-types.ts';
import type { TeamDefinition } from './team-types.ts';
import { validateTeamDefinitions } from './team-validator.ts';

const DEFAULT_TEAM_DEFINITIONS_DIR = 'control-plane/teams/definitions';

function loadJsonFiles<T>(dir: string): Array<{ file: string; data: T }> {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => {
      const filePath = path.join(dir, entry);
      const raw = fs.readFileSync(filePath, 'utf8');
      return {
        file: entry,
        data: JSON.parse(raw) as T
      };
    });
}

function toAgentIdSet(agentProfiles: AgentProfileDefinition[]): Set<string> {
  return new Set(agentProfiles.map((profile) => profile.agentId));
}

export function loadTeamDefinitionsFromDir(
  dir: string = DEFAULT_TEAM_DEFINITIONS_DIR,
  agentProfiles: AgentProfileDefinition[] = []
): TeamDefinition[] {
  const loaded = loadJsonFiles<unknown>(dir).map(({ data }) => data);
  return validateTeamDefinitions(loaded, toAgentIdSet(agentProfiles));
}

export function loadTeamDefinitionById(
  teamId: string,
  dir: string = DEFAULT_TEAM_DEFINITIONS_DIR,
  agentProfiles: AgentProfileDefinition[] = []
): TeamDefinition {
  const teams = loadTeamDefinitionsFromDir(dir, agentProfiles);
  const team = teams.find((entry) => entry.teamId === teamId);
  if (!team) {
    throw new Error(`Team definition not found: ${teamId}`);
  }
  return team;
}
