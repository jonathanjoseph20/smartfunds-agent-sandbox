import type { MissionDefinition, MissionPriority } from './mission-types.ts';

const MISSION_PRIORITIES: MissionPriority[] = ['low', 'medium', 'high', 'critical'];

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

function parsePriority(value: unknown, missionId: string): MissionPriority | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!MISSION_PRIORITIES.includes(value as MissionPriority)) {
    throw new Error(`Mission ${missionId} priority must be one of ${MISSION_PRIORITIES.join(', ')}.`);
  }
  return value as MissionPriority;
}

function parseInitialContext(value: unknown, missionId: string): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Mission ${missionId} initialContext must be an object.`);
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function parseStringRecord(value: unknown, label: string): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object of string values.`);
  }

  const entries = Object.entries(value as Record<string, unknown>);
  for (const [, entryValue] of entries) {
    if (!isNonEmptyString(entryValue)) {
      throw new Error(`${label} must be an object of string values.`);
    }
  }

  return Object.fromEntries(
    entries
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, entryValue as string])
  );
}

function parseParameterSchema(value: unknown, missionId: string): MissionDefinition['parameterSchema'] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Mission ${missionId} parameterSchema must be an object.`);
  }

  const record = value as Record<string, unknown>;
  const allowed = record.allowed === undefined
    ? undefined
    : sortedUnique(ensureStringArray(record.allowed, `Mission ${missionId} parameterSchema.allowed`));
  const required = record.required === undefined
    ? undefined
    : sortedUnique(ensureStringArray(record.required, `Mission ${missionId} parameterSchema.required`));
  const defaults = record.defaults === undefined
    ? undefined
    : parseStringRecord(record.defaults, `Mission ${missionId} parameterSchema.defaults`);
  const descriptions = record.descriptions === undefined
    ? undefined
    : parseStringRecord(record.descriptions, `Mission ${missionId} parameterSchema.descriptions`);

  return {
    ...(allowed ? { allowed } : {}),
    ...(required ? { required } : {}),
    ...(defaults ? { defaults } : {}),
    ...(descriptions ? { descriptions } : {})
  };
}

export function validateMissionDefinition(value: unknown): MissionDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Mission definition must be an object.');
  }

  const record = value as Record<string, unknown>;

  assertNonEmptyString(record.missionId, 'missionId');
  assertNonEmptyString(record.projectId, `Mission ${record.missionId} projectId`);
  assertNonEmptyString(record.teamId, `Mission ${record.missionId} teamId`);
  assertNonEmptyString(record.workflowId, `Mission ${record.missionId} workflowId`);
  assertNonEmptyString(record.objective, `Mission ${record.missionId} objective`);

  const successCriteria = record.successCriteria === undefined
    ? []
    : ensureStringArray(record.successCriteria, `Mission ${record.missionId} successCriteria`);

  const deliverables = record.deliverables === undefined
    ? []
    : ensureStringArray(record.deliverables, `Mission ${record.missionId} deliverables`);

  const priority = parsePriority(record.priority, record.missionId);
  const parameterSchema = parseParameterSchema(record.parameterSchema, record.missionId);

  return {
    missionId: record.missionId,
    ...(isNonEmptyString(record.name) ? { name: record.name } : {}),
    projectId: record.projectId,
    teamId: record.teamId,
    workflowId: record.workflowId,
    objective: record.objective,
    successCriteria: sortedUnique(successCriteria),
    deliverables: sortedUnique(deliverables),
    initialContext: parseInitialContext(record.initialContext, record.missionId),
    ...(parameterSchema ? { parameterSchema } : {}),
    ...(isNonEmptyString(record.description) ? { description: record.description } : {}),
    ...(priority ? { priority } : {}),
    ...(record.constraints !== undefined
      ? { constraints: sortedUnique(ensureStringArray(record.constraints, `Mission ${record.missionId} constraints`)) }
      : {}),
    ...(isNonEmptyString(record.deadlineHint) ? { deadlineHint: record.deadlineHint } : {}),
    ...(record.tags !== undefined
      ? { tags: sortedUnique(ensureStringArray(record.tags, `Mission ${record.missionId} tags`)) }
      : {}),
    ...(isNonEmptyString(record.owner) ? { owner: record.owner } : {}),
    ...(isNonEmptyString(record.notes) ? { notes: record.notes } : {})
  };
}

export function validateMissionDefinitions(values: unknown[]): MissionDefinition[] {
  const validated = values.map(validateMissionDefinition);
  const ids = validated.map((mission) => mission.missionId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  if (duplicates.length > 0) {
    throw new Error(`Duplicate missionId detected: ${sortedUnique(duplicates).join(', ')}.`);
  }

  return [...validated].sort((left, right) => left.missionId.localeCompare(right.missionId));
}
