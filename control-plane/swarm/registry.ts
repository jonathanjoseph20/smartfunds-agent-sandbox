import type { SwarmDefinition, SwarmRole, SwarmStep } from './types.ts';

const registry = new Map<string, SwarmDefinition>();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(`ERR_SWARM_INVALID_${label.toUpperCase()}`);
  }
}

function assertUniqueRoleIds(roles: SwarmRole[]): void {
  const ids = roles.map((role) => role.roleId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`ERR_SWARM_DUPLICATE_ROLE_ID: ${Array.from(new Set(duplicates)).join(', ')}`);
  }
}

function assertUniqueStepIndexes(steps: SwarmStep[]): void {
  const indexes = steps.map((step) => step.stepIndex);
  const duplicates = indexes.filter((id, index) => indexes.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`ERR_SWARM_DUPLICATE_STEP_INDEX: ${Array.from(new Set(duplicates)).join(', ')}`);
  }
}

function assertStepIndexesValid(steps: SwarmStep[]): void {
  for (const step of steps) {
    if (!Number.isInteger(step.stepIndex)) {
      throw new Error('ERR_SWARM_STEP_INDEX_INVALID');
    }
  }
}

function sortRoles(roles: SwarmRole[]): SwarmRole[] {
  return [...roles].sort((a, b) => a.roleId.localeCompare(b.roleId));
}

function sortSteps(steps: SwarmStep[]): SwarmStep[] {
  return [...steps].sort((a, b) => a.stepIndex - b.stepIndex);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
  } else {
    for (const key of Object.keys(value)) {
      const record = value as Record<string, unknown>;
      deepFreeze(record[key]);
    }
  }
  return value;
}

export function normalizeSwarmDefinition(def: SwarmDefinition): SwarmDefinition {
  assertNonEmptyString(def.swarmId, 'swarm_id');
  assertUniqueRoleIds(def.roles);
  assertUniqueStepIndexes(def.steps);
  assertStepIndexesValid(def.steps);

  return {
    swarmId: def.swarmId,
    mode: def.mode,
    roles: sortRoles(def.roles),
    steps: sortSteps(def.steps)
  };
}

export function registerSwarm(def: SwarmDefinition): void {
  const normalized = normalizeSwarmDefinition(def);
  if (registry.has(normalized.swarmId)) {
    throw new Error(`ERR_SWARM_DUPLICATE_ID: ${normalized.swarmId}`);
  }
  registry.set(normalized.swarmId, deepFreeze(normalized));
}

export function getSwarm(swarmId: string): SwarmDefinition {
  const stored = registry.get(swarmId);
  if (!stored) {
    throw new Error(`ERR_SWARM_NOT_FOUND: ${swarmId}`);
  }
  return stored;
}

export function listSwarms(): SwarmDefinition[] {
  return Array.from(registry.values()).sort((a, b) => a.swarmId.localeCompare(b.swarmId));
}

export function clearSwarmRegistryForTests(): void {
  registry.clear();
}
