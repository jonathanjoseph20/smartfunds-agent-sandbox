import type { TeamDefinition, TeamExecutionMode } from './team-types.ts';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (!isStringArray(value)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return value;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseExecutionMode(value: unknown, label: string): TeamExecutionMode {
  if (value === 'structured' || value === 'autonomous') {
    return value;
  }
  throw new Error(`${label} must be "structured" or "autonomous".`);
}

function parseOptionalStringArray(value: unknown, label: string): string[] {
  if (value === undefined) {
    return [];
  }
  return sortedUnique(ensureStringArray(value, label));
}

export function validateTeamDefinition(value: unknown, knownAgentIds: Set<string> = new Set()): TeamDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Team definition must be an object.');
  }

  const record = value as Record<string, unknown>;

  assertNonEmptyString(record.teamId, 'teamId');
  assertNonEmptyString(record.name, `Team ${record.teamId} name`);
  assertNonEmptyString(record.projectId, `Team ${record.teamId} projectId`);

  const members = ensureStringArray(record.members, `Team ${record.teamId} members`);
  if (members.length === 0) {
    throw new Error(`Team ${record.teamId} members must contain at least one agentId.`);
  }

  const duplicates = members.filter((member, index) => members.indexOf(member) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Team ${record.teamId} has duplicate members: ${sortedUnique(duplicates).join(', ')}.`);
  }

  const missingMembers = members.filter((member) => knownAgentIds.size > 0 && !knownAgentIds.has(member));
  if (missingMembers.length > 0) {
    throw new Error(`Team ${record.teamId} references unknown agent profiles: ${sortedUnique(missingMembers).join(', ')}.`);
  }

  return {
    teamId: record.teamId,
    name: record.name,
    projectId: record.projectId,
    members: sortedUnique(members),
    executionMode: parseExecutionMode(record.executionMode, `Team ${record.teamId} executionMode`),
    ...(isNonEmptyString(record.description) ? { description: record.description } : {}),
    ...(isNonEmptyString(record.teamObjective) ? { teamObjective: record.teamObjective } : {}),
    defaultWorkflowIds: parseOptionalStringArray(
      record.defaultWorkflowIds,
      `Team ${record.teamId} defaultWorkflowIds`
    ),
    constraints: parseOptionalStringArray(record.constraints, `Team ${record.teamId} constraints`),
    handoffRules: parseOptionalStringArray(record.handoffRules, `Team ${record.teamId} handoffRules`),
    ...(isNonEmptyString(record.notes) ? { notes: record.notes } : {})
  };
}

export function validateTeamDefinitions(values: unknown[], knownAgentIds: Set<string> = new Set()): TeamDefinition[] {
  const validated = values.map((value) => validateTeamDefinition(value, knownAgentIds));
  const ids = validated.map((team) => team.teamId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  if (duplicates.length > 0) {
    throw new Error(`Duplicate teamId detected: ${sortedUnique(duplicates).join(', ')}.`);
  }

  return [...validated].sort((left, right) => left.teamId.localeCompare(right.teamId));
}
