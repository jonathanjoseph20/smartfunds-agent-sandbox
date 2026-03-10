import type { MissionDefinition, MissionPriority } from './mission-types.ts';
import type { CapabilityClass, MutationIntent, PolicyProfile } from '../policy/types.ts';

const MISSION_PRIORITIES: MissionPriority[] = ['low', 'medium', 'high', 'critical'];
const POLICY_PROFILES: PolicyProfile[] = ['lite', 'build', 'core'];
const CAPABILITY_CLASSES: CapabilityClass[] = ['artifact_write', 'pr_open', 'protected_write', 'read', 'repo_write'];
const MUTATION_INTENTS: MutationIntent[] = [
  'none',
  'artifact',
  'code_change',
  'ui_change',
  'product_update',
  'tooling_change',
  'governance_change',
  'protected_infra_mutation',
  'financial_rail_mutation',
  'entity_registry_mutation',
  'control_plane_mutation'
];

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

function parseProfile(value: unknown, missionId: string): PolicyProfile | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!POLICY_PROFILES.includes(value as PolicyProfile)) {
    throw new Error(`Mission ${missionId} profile must be one of ${POLICY_PROFILES.join(', ')}.`);
  }
  return value as PolicyProfile;
}

function parseMutationIntent(value: unknown, missionId: string): MutationIntent | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!MUTATION_INTENTS.includes(value as MutationIntent)) {
    throw new Error(`Mission ${missionId} mutationIntent must be one of ${MUTATION_INTENTS.join(', ')}.`);
  }
  return value as MutationIntent;
}

function parseRequestedCapabilities(value: unknown, missionId: string): CapabilityClass[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const requested = ensureStringArray(value, `Mission ${missionId} requestedCapabilities`);
  const invalid = requested.filter((capability) => !CAPABILITY_CLASSES.includes(capability as CapabilityClass));
  if (invalid.length > 0) {
    throw new Error(
      `Mission ${missionId} requestedCapabilities contains unsupported capability classes: ${sortedUnique(invalid).join(', ')}.`
    );
  }

  return sortedUnique(requested) as CapabilityClass[];
}

function parseTargetScope(value: unknown, missionId: string): MissionDefinition['targetScope'] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Mission ${missionId} targetScope must be an object.`);
  }

  const record = value as Record<string, unknown>;
  assertNonEmptyString(record.repo, `Mission ${missionId} targetScope.repo`);
  const paths = record.paths === undefined
    ? undefined
    : sortedUnique(ensureStringArray(record.paths, `Mission ${missionId} targetScope.paths`));

  return {
    repo: record.repo,
    ...(paths ? { paths } : {})
  };
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
  const profile = parseProfile(record.profile, record.missionId);
  const mutationIntent = parseMutationIntent(record.mutationIntent, record.missionId);
  const requestedCapabilities = parseRequestedCapabilities(record.requestedCapabilities, record.missionId);
  const targetScope = parseTargetScope(record.targetScope, record.missionId);
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
    ...(profile ? { profile } : {}),
    ...(mutationIntent ? { mutationIntent } : {}),
    ...(requestedCapabilities ? { requestedCapabilities } : {}),
    ...(targetScope ? { targetScope } : {}),
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
