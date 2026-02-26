import type { ExecutionMode, TeamDefinition } from './types.ts';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function ensureNonEmptyArray(value: unknown, label: string): string[] {
  if (!isStringArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  return value;
}

function assertExecutionMode(value: unknown, label: string): ExecutionMode {
  if (value !== 'structured' && value !== 'autonomous') {
    throw new Error(`${label} must be "structured" or "autonomous".`);
  }
  return value;
}

function sortOwnedPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => a.localeCompare(b));
}

export function validateTeamRegistry(teams: TeamDefinition[]): TeamDefinition[] {
  const normalized = teams.map((team, index) => {
    if (!isNonEmptyString(team.teamId)) {
      throw new Error(`Team at index ${index} must include non-empty teamId.`);
    }
    const ownedPaths = ensureNonEmptyArray(team.ownedPaths, `Team ${team.teamId} ownedPaths`);
    return {
      ...team,
      teamId: team.teamId,
      executionMode: assertExecutionMode(team.executionMode, `Team ${team.teamId} executionMode`),
      ownedPaths: sortOwnedPaths(ownedPaths)
    };
  });

  const teamIds = normalized.map((team) => team.teamId);
  const idSet = new Set(teamIds);
  if (idSet.size !== teamIds.length) {
    const duplicates = teamIds.filter((id, index) => teamIds.indexOf(id) !== index);
    throw new Error(`Duplicate teamId detected: ${Array.from(new Set(duplicates)).join(', ')}.`);
  }

  return [...normalized].sort((a, b) => a.teamId.localeCompare(b.teamId));
}
