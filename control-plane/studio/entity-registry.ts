import fs from 'node:fs';
import path from 'node:path';

import type { Project } from './registry.ts';

const CUSTODY_MODES = ['non_custodial', 'managed', 'escrow_based'] as const;

type CustodyMode = (typeof CUSTODY_MODES)[number];

export type EntityRegistryEntry = {
  entityId: string;
  legalName: string;
  projects: string[];
  complianceProfile: string;
  custodyMode: CustodyMode;
  notes?: string;
  defaultRails?: string[];
};

export type EntityRegistry = {
  entities: EntityRegistryEntry[];
  projectToEntity: Map<string, string>;
};

export type EntityOwnershipStatus = 'ok' | 'multi_entity' | 'unknown_entity_mapping';

export type EntityTelemetry = {
  entitiesTouched: string[];
  entityOwnershipStatus: EntityOwnershipStatus;
  unmappedProjects: string[];
  entityByProject: Record<string, string | null>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
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
  if (!isNonEmptyString(value)) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (!isStringArray(value)) {
    throw new Error(`${label} must be a string array of non-empty strings.`);
  }
  return value;
}

function ensureSorted(values: string[], label: string): void {
  const sorted = [...values].sort((a, b) => a.localeCompare(b));
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== sorted[i]) {
      throw new Error(`${label} must be sorted.`);
    }
  }
}

function assertKebabCase(value: string, label: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`${label} must be kebab-case.`);
  }
}

function assertCustodyMode(value: unknown, label: string): asserts value is CustodyMode {
  if (!CUSTODY_MODES.includes(value as CustodyMode)) {
    throw new Error(`${label} must be one of ${CUSTODY_MODES.join(', ')}.`);
  }
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function validateNoDuplicateProjectsAcrossEntities(entities: EntityRegistryEntry[]): void {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const entity of entities) {
    for (const projectId of entity.projects) {
      if (seen.has(projectId)) {
        duplicates.push(projectId);
      } else {
        seen.add(projectId);
      }
    }
  }

  const uniqueDuplicates = sortedUnique(duplicates);
  if (uniqueDuplicates.length > 0) {
    throw new Error(`ProjectId appears in multiple entities: ${uniqueDuplicates.join(', ')}`);
  }
}

function assertNoDuplicateEntityIds(entities: EntityRegistryEntry[]): void {
  const ids = entities.map((entity) => entity.entityId);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  const uniqueDuplicates = sortedUnique(duplicates);
  if (uniqueDuplicates.length > 0) {
    throw new Error(`Duplicate entityId: ${uniqueDuplicates.join(', ')}`);
  }
}

function collectProjectIdsFromDir(projectsDir: string): Set<string> {
  if (!fs.existsSync(projectsDir)) {
    return new Set<string>();
  }

  const entries = fs.readdirSync(projectsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const ids: string[] = [];

  for (const entry of entries) {
    const filePath = path.join(projectsDir, entry);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    if (isNonEmptyString(raw.id)) {
      ids.push(raw.id);
      continue;
    }
    if (isNonEmptyString(raw.projectId)) {
      ids.push(raw.projectId);
      continue;
    }
    throw new Error(`Project file ${filePath} must include non-empty id or projectId.`);
  }

  return new Set(sortedUnique(ids));
}

function assertReferencedProjectsExist(entities: EntityRegistryEntry[], projectsDir: string): void {
  const projectIds = collectProjectIdsFromDir(projectsDir);

  for (const entity of entities) {
    for (const projectId of entity.projects) {
      if (!projectIds.has(projectId)) {
        throw new Error(`Unknown projectId referenced by entity ${entity.entityId}: ${projectId}`);
      }
    }
  }
}

function parseEntityRegistry(raw: unknown): EntityRegistryEntry[] {
  if (!Array.isArray(raw)) {
    throw new Error('Entity registry must be an array.');
  }

  const entities = raw.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Entity at index ${index} must be an object.`);
    }
    const data = entry as Record<string, unknown>;
    const entityId = ensureNonEmptyString(data.entityId, `Entity ${index} entityId`);
    assertKebabCase(entityId, `Entity ${entityId} entityId`);
    const legalName = ensureNonEmptyString(data.legalName, `Entity ${entityId} legalName`);
    const projects = ensureStringArray(data.projects, `Entity ${entityId} projects`);
    if (projects.length === 0) {
      throw new Error(`Entity ${entityId} projects must be a non-empty string array.`);
    }
    ensureSorted(projects, `Entity ${entityId} projects`);
    const complianceProfile = ensureNonEmptyString(data.complianceProfile, `Entity ${entityId} complianceProfile`);
    assertCustodyMode(data.custodyMode, `Entity ${entityId} custodyMode`);

    const notes = ensureOptionalString(data.notes, `Entity ${entityId} notes`);
    const defaultRails = data.defaultRails === undefined
      ? undefined
      : ensureStringArray(data.defaultRails, `Entity ${entityId} defaultRails`);
    if (defaultRails) {
      ensureSorted(defaultRails, `Entity ${entityId} defaultRails`);
    }

    return {
      entityId,
      legalName,
      projects,
      complianceProfile,
      custodyMode: data.custodyMode,
      notes,
      defaultRails
    } satisfies EntityRegistryEntry;
  });

  ensureSorted(
    entities.map((entity) => entity.entityId),
    'Entities'
  );
  assertNoDuplicateEntityIds(entities);
  validateNoDuplicateProjectsAcrossEntities(entities);

  return entities;
}

export function loadEntityRegistry(options: { registryPath?: string; projectsDir?: string } = {}): EntityRegistry {
  const registryPath = options.registryPath ?? path.resolve('control-plane/entities/registry.json');
  const projectsDir = options.projectsDir ?? path.resolve('control-plane/projects');

  const raw = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as unknown;
  const entities = parseEntityRegistry(raw);

  assertReferencedProjectsExist(entities, projectsDir);

  const projectToEntity = new Map<string, string>();
  for (const entity of entities) {
    for (const projectId of entity.projects) {
      projectToEntity.set(projectId, entity.entityId);
    }
  }

  return { entities, projectToEntity };
}

export function getEntityForProject(projectId: string, registry: EntityRegistry): string | null {
  return registry.projectToEntity.get(projectId) ?? null;
}

export function getEntitiesForProjects(projectIds: string[], registry: EntityRegistry): string[] {
  const entities: string[] = [];
  for (const projectId of projectIds) {
    const entityId = getEntityForProject(projectId, registry);
    if (entityId) {
      entities.push(entityId);
    }
  }
  return sortedUnique(entities);
}

export function buildEntityTelemetry(projectsTouched: string[], registry: EntityRegistry): EntityTelemetry {
  const orderedProjects = sortedUnique(projectsTouched);
  const unmappedProjects: string[] = [];
  const entitiesTouched: string[] = [];
  const entityByProject: Record<string, string | null> = {};

  for (const projectId of orderedProjects) {
    const entityId = getEntityForProject(projectId, registry);
    if (!entityId) {
      unmappedProjects.push(projectId);
      entityByProject[projectId] = null;
      continue;
    }
    entitiesTouched.push(entityId);
    entityByProject[projectId] = entityId;
  }

  const orderedEntities = sortedUnique(entitiesTouched);
  let entityOwnershipStatus: EntityOwnershipStatus = 'ok';
  if (unmappedProjects.length > 0) {
    entityOwnershipStatus = 'unknown_entity_mapping';
  } else if (orderedEntities.length > 1) {
    entityOwnershipStatus = 'multi_entity';
  }

  return {
    entitiesTouched: orderedEntities,
    entityOwnershipStatus,
    unmappedProjects: sortedUnique(unmappedProjects),
    entityByProject
  };
}

export function buildEntityTelemetryFromProjects(projectsTouched: string[], projects: Project[]): EntityTelemetry {
  const orderedProjectsTouched = sortedUnique(projectsTouched);
  const projectEntityMap = new Map(
    projects
      .filter((project) => isNonEmptyString(project.entityId))
      .map((project) => [project.projectId, project.entityId as string])
  );

  const unmappedProjects: string[] = [];
  const entitiesTouched: string[] = [];
  const entityByProject: Record<string, string | null> = {};

  for (const projectId of orderedProjectsTouched) {
    const entityId = projectEntityMap.get(projectId) ?? null;
    entityByProject[projectId] = entityId;
    if (entityId === null) {
      unmappedProjects.push(projectId);
      continue;
    }
    entitiesTouched.push(entityId);
  }

  const orderedEntities = sortedUnique(entitiesTouched);
  let entityOwnershipStatus: EntityOwnershipStatus = 'ok';
  if (unmappedProjects.length > 0) {
    entityOwnershipStatus = 'unknown_entity_mapping';
  } else if (orderedEntities.length > 1) {
    entityOwnershipStatus = 'multi_entity';
  }

  return {
    entitiesTouched: orderedEntities,
    entityOwnershipStatus,
    unmappedProjects: sortedUnique(unmappedProjects),
    entityByProject
  };
}

export function buildFallbackEntityTelemetry(projectsTouched: string[]): EntityTelemetry {
  const orderedProjects = sortedUnique(projectsTouched);
  const entityByProject: Record<string, string | null> = {};
  for (const projectId of orderedProjects) {
    entityByProject[projectId] = null;
  }

  return {
    entitiesTouched: [],
    entityOwnershipStatus: orderedProjects.length > 0 ? 'unknown_entity_mapping' : 'ok',
    unmappedProjects: orderedProjects,
    entityByProject
  };
}

export function resolveEntityTelemetry(
  projectsTouched: string[],
  options: { registryPath?: string; projectsDir?: string } = {}
): { telemetry: EntityTelemetry; warnings: string[]; nextActions: string[] } {
  const warnings: string[] = [];
  const nextActions: string[] = [];
  let telemetry: EntityTelemetry;

  try {
    const registry = loadEntityRegistry(options);
    telemetry = buildEntityTelemetry(projectsTouched, registry);
  } catch (error) {
    warnings.push(`Entity registry error: ${(error as Error).message}`);
    nextActions.push('Review control-plane/entities/registry.json for schema or mapping errors.');
    telemetry = buildFallbackEntityTelemetry(projectsTouched);
  }

  if (telemetry.entityOwnershipStatus === 'unknown_entity_mapping') {
    nextActions.push('Add missing projectId to control-plane/entities/registry.json.');
  } else if (telemetry.entityOwnershipStatus === 'multi_entity') {
    nextActions.push('Sprint 21 will enforce single-entity PRs; consider splitting changes by entity.');
  }

  return { telemetry, warnings, nextActions };
}

export function resolveEntityTelemetryFromProjects(
  projectsTouched: string[],
  projects: Project[]
): { telemetry: EntityTelemetry; warnings: string[]; nextActions: string[] } {
  const telemetry = buildEntityTelemetryFromProjects(projectsTouched, projects);
  const warnings: string[] = [];
  const nextActions: string[] = [];

  if (telemetry.entityOwnershipStatus === 'unknown_entity_mapping') {
    nextActions.push('Add missing entity field to entities/projects/*.json for each touched project.');
  } else if (telemetry.entityOwnershipStatus === 'multi_entity') {
    nextActions.push('Sprint 21 will enforce single-entity PRs; consider splitting changes by entity.');
  }

  return { telemetry, warnings, nextActions };
}
