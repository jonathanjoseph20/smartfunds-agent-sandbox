import fs from 'node:fs';
import path from 'node:path';

import type {
  MissionAgentDefinition,
  MissionRegistryBundle,
  MissionTeamDefinition,
  MissionTeamRegistry,
  MissionTemplateDefinition
} from './mission-control-types.ts';

const DEFAULT_TEAM_REGISTRY_PATH = 'control-plane/teams/registry.json';
const DEFAULT_TEAMS_DIR = 'control-plane/teams/teams';
const DEFAULT_AGENTS_DIR = 'control-plane/teams/agents';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isNonEmptyString)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return Array.from(new Set(value)).sort((left, right) => left.localeCompare(right));
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function assertSorted(values: string[], label: string): void {
  const sorted = [...values].sort((left, right) => left.localeCompare(right));
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] !== sorted[index]) {
      throw new Error(`${label} must be sorted deterministically.`);
    }
  }
}

function parseRegistry(value: unknown): MissionTeamRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Team registry must be an object.');
  }

  const record = value as Record<string, unknown>;
  if (typeof record.schemaVersion !== 'number') {
    throw new Error('Team registry schemaVersion must be a number.');
  }

  const teams = ensureStringArray(record.teams, 'Team registry teams');
  assertSorted(record.teams as string[], 'Team registry teams');

  return {
    schemaVersion: record.schemaVersion,
    teams
  };
}

function parseTeam(value: unknown): MissionTeamDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Team definition must be an object.');
  }

  const record = value as Record<string, unknown>;
  if (!isNonEmptyString(record.teamId)) {
    throw new Error('Team definition teamId must be a non-empty string.');
  }
  if (record.teamType !== 'persistent' && record.teamType !== 'specialized') {
    throw new Error(`Team ${record.teamId} teamType must be persistent or specialized.`);
  }
  if (record.persistence !== 'persistent' && record.persistence !== 'ephemeral') {
    throw new Error(`Team ${record.teamId} persistence must be persistent or ephemeral.`);
  }
  if (!isNonEmptyString(record.description)) {
    throw new Error(`Team ${record.teamId} description must be a non-empty string.`);
  }

  const capabilities = ensureStringArray(record.capabilities, `Team ${record.teamId} capabilities`);
  const missionCompatibility = ensureStringArray(record.missionCompatibility, `Team ${record.teamId} missionCompatibility`);
  const tools = ensureStringArray(record.tools, `Team ${record.teamId} tools`);

  if (!Array.isArray(record.roles) || record.roles.length === 0) {
    throw new Error(`Team ${record.teamId} roles must be a non-empty array.`);
  }

  const roles = record.roles.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Team ${record.teamId} roles[${index}] must be an object.`);
    }
    const role = entry as Record<string, unknown>;
    if (!isNonEmptyString(role.slotId) || !isNonEmptyString(role.agentId)) {
      throw new Error(`Team ${record.teamId} roles[${index}] must include slotId and agentId.`);
    }
    return {
      slotId: role.slotId,
      agentId: role.agentId
    };
  }).sort((left, right) => left.slotId.localeCompare(right.slotId));

  return {
    teamId: record.teamId,
    teamType: record.teamType,
    persistence: record.persistence,
    description: record.description,
    capabilities,
    missionCompatibility,
    tools,
    roles
  };
}

function parseAgent(value: unknown): MissionAgentDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Agent definition must be an object.');
  }

  const record = value as Record<string, unknown>;
  if (!isNonEmptyString(record.agentId)) {
    throw new Error('Agent definition agentId must be a non-empty string.');
  }

  const personality = record.personality as Record<string, unknown> | undefined;
  if (!personality || typeof personality !== 'object' || Array.isArray(personality)) {
    throw new Error(`Agent ${record.agentId} personality must be an object.`);
  }
  if (!isNonEmptyString(personality.riskPosture) || !isNonEmptyString(personality.communication)) {
    throw new Error(`Agent ${record.agentId} personality must include riskPosture and communication.`);
  }

  return {
    agentId: record.agentId,
    skills: ensureStringArray(record.skills, `Agent ${record.agentId} skills`),
    personality: {
      riskPosture: personality.riskPosture,
      communication: personality.communication
    },
    tools: ensureStringArray(record.tools, `Agent ${record.agentId} tools`)
  };
}

function loadJsonDir(dir: string): unknown[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => readJson(path.join(dir, entry)));
}

export function loadMissionRegistryBundle(input: {
  registryPath?: string;
  teamsDir?: string;
  agentsDir?: string;
} = {}): MissionRegistryBundle {
  const registry = parseRegistry(readJson(input.registryPath ?? DEFAULT_TEAM_REGISTRY_PATH));
  const teams = loadJsonDir(input.teamsDir ?? DEFAULT_TEAMS_DIR).map(parseTeam)
    .sort((left, right) => left.teamId.localeCompare(right.teamId));
  const agents = loadJsonDir(input.agentsDir ?? DEFAULT_AGENTS_DIR).map(parseAgent)
    .sort((left, right) => left.agentId.localeCompare(right.agentId));

  const teamIds = teams.map((team) => team.teamId);
  const missingTeamDefs = registry.teams.filter((teamId) => !teamIds.includes(teamId));
  if (missingTeamDefs.length > 0) {
    throw new Error(`Team registry references missing team definitions: ${missingTeamDefs.join(', ')}.`);
  }

  const missingRegistryRefs = teamIds.filter((teamId) => !registry.teams.includes(teamId));
  if (missingRegistryRefs.length > 0) {
    throw new Error(`Team definitions missing from registry: ${missingRegistryRefs.sort((a, b) => a.localeCompare(b)).join(', ')}.`);
  }

  const knownAgents = new Set(agents.map((agent) => agent.agentId));
  for (const team of teams) {
    const unknown = team.roles
      .map((role) => role.agentId)
      .filter((agentId) => !knownAgents.has(agentId));
    if (unknown.length > 0) {
      throw new Error(`Team ${team.teamId} references unknown agents: ${Array.from(new Set(unknown)).sort((a, b) => a.localeCompare(b)).join(', ')}.`);
    }
  }

  return {
    registry,
    teams,
    agents
  };
}

export function validateMissionTemplateAgainstRegistry(
  template: MissionTemplateDefinition,
  bundle: MissionRegistryBundle
): void {
  const team = bundle.teams.find((entry) => entry.teamId === template.teamId);
  if (!team) {
    throw new Error(`Mission template ${template.missionId} references unknown team ${template.teamId}.`);
  }

  if (!team.missionCompatibility.includes(template.missionType)) {
    throw new Error(
      `Mission template ${template.missionId} missionType ${template.missionType} is incompatible with team ${team.teamId}.`
    );
  }
}
