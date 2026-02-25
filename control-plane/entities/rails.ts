import fs from 'node:fs';
import path from 'node:path';

export const RAIL_PROFILES = ['structured-only', 'autonomous-only', 'hybrid', 'restricted'] as const;

export type RailProfile = (typeof RAIL_PROFILES)[number];

export type RailProfileEntry = {
  entityId: string;
  railProfile: RailProfile;
  description?: string;
};

export type RailRegistry = {
  version: 1;
  entities: RailProfileEntry[];
  railProfileByEntity: Map<string, RailProfile>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function ensureNonEmptyString(value: unknown, label: string): string {
  if (!isNonEmptyString(value)) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function ensureOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return ensureNonEmptyString(value, label);
}

function assertRailProfile(value: unknown, label: string): asserts value is RailProfile {
  if (!RAIL_PROFILES.includes(value as RailProfile)) {
    throw new Error(`${label} must be one of ${RAIL_PROFILES.join(', ')}.`);
  }
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function assertNoDuplicateEntityIds(entities: RailProfileEntry[]): void {
  const ids = entities.map((entity) => entity.entityId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  const uniqueDuplicates = sortedUnique(duplicates);
  if (uniqueDuplicates.length > 0) {
    throw new Error(`Duplicate entityId: ${uniqueDuplicates.join(', ')}`);
  }
}

function parseRailRegistry(raw: unknown): { version: 1; entities: RailProfileEntry[] } {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Rails registry must be an object.');
  }

  const data = raw as Record<string, unknown>;
  if (data.version !== 1) {
    throw new Error('Rails registry version must be 1.');
  }

  if (!Array.isArray(data.entities)) {
    throw new Error('Rails registry entities must be an array.');
  }

  const parsedEntities = data.entities.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Rails registry entity at index ${index} must be an object.`);
    }
    const item = entry as Record<string, unknown>;
    const entityId = ensureNonEmptyString(item.entityId, `Rails entity ${index} entityId`);
    assertRailProfile(item.railProfile, `Rails entity ${entityId} railProfile`);
    const description = ensureOptionalString(item.description, `Rails entity ${entityId} description`);

    return {
      entityId,
      railProfile: item.railProfile,
      description
    } satisfies RailProfileEntry;
  });

  assertNoDuplicateEntityIds(parsedEntities);

  const entities = [...parsedEntities].sort((a, b) => a.entityId.localeCompare(b.entityId));
  return { version: 1, entities };
}

export function loadRailsRegistry(options: { registryPath?: string } = {}): RailRegistry {
  const registryPath = options.registryPath ?? path.resolve('control-plane/entities/rails.json');
  const raw = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as unknown;
  const parsed = parseRailRegistry(raw);

  const railProfileByEntity = new Map<string, RailProfile>();
  for (const entity of parsed.entities) {
    railProfileByEntity.set(entity.entityId, entity.railProfile);
  }

  return {
    version: parsed.version,
    entities: parsed.entities,
    railProfileByEntity
  };
}

export function getRailProfile(entityId: string, registry: RailRegistry): RailProfile | null {
  return registry.railProfileByEntity.get(entityId) ?? null;
}

export function listRailProfiles(registry: RailRegistry): Array<{ entityId: string; railProfile: RailProfile; description?: string }> {
  return registry.entities.map((entity) => ({
    entityId: entity.entityId,
    railProfile: entity.railProfile,
    ...(entity.description ? { description: entity.description } : {})
  }));
}
