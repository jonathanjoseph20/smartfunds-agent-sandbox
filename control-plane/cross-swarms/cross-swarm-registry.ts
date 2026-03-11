import fs from 'node:fs';
import path from 'node:path';

import {
  CROSS_SWARM_GROUP_TYPES,
  CROSS_SWARM_MATCH_DIMENSIONS,
  CrossSwarmError,
  type CrossSwarmDefinition,
  type CrossSwarmGroupType,
  type CrossSwarmMatchDimension
} from './cross-swarm-types.ts';

export const DEFAULT_CROSS_SWARM_DEFINITIONS_DIR = 'control-plane/cross-swarms/definitions';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asUniqueStringArray(value: unknown, sourceLabel: string, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`);
  }

  const normalized = value.map((entry) => asTrimmedString(entry));
  if (normalized.some((entry) => !entry)) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`);
  }

  return Array.from(new Set(normalized as string[])).sort((left, right) => left.localeCompare(right));
}

function asMatchDimensionArray(value: unknown, sourceLabel: string): CrossSwarmMatchDimension[] {
  const dimensions = asUniqueStringArray(value, sourceLabel, 'requiredMatchDimensions');
  if (dimensions.some((entry) => !CROSS_SWARM_MATCH_DIMENSIONS.includes(entry as CrossSwarmMatchDimension))) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} requiredMatchDimensions contains unsupported value.`);
  }

  return dimensions as CrossSwarmMatchDimension[];
}

function asGroupType(value: unknown, sourceLabel: string): CrossSwarmGroupType {
  const parsed = asTrimmedString(value);
  if (!parsed || !CROSS_SWARM_GROUP_TYPES.includes(parsed as CrossSwarmGroupType)) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} groupType is invalid.`);
  }
  return parsed as CrossSwarmGroupType;
}

function validateScope(value: unknown, sourceLabel: string): CrossSwarmDefinition['scope'] {
  if (!isRecord(value)) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} scope must be an object.`);
  }

  return {
    teamIds: asUniqueStringArray(value.teamIds ?? [], sourceLabel, 'scope.teamIds'),
    subjectKeys: asUniqueStringArray(value.subjectKeys ?? [], sourceLabel, 'scope.subjectKeys')
  };
}

function validateInclude(value: unknown, sourceLabel: string): CrossSwarmDefinition['include'] {
  if (!isRecord(value)) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} include must be an object.`);
  }

  return {
    swarmIds: asUniqueStringArray(value.swarmIds ?? [], sourceLabel, 'include.swarmIds'),
    teamIds: asUniqueStringArray(value.teamIds ?? [], sourceLabel, 'include.teamIds'),
    protocolFamilies: asUniqueStringArray(value.protocolFamilies ?? [], sourceLabel, 'include.protocolFamilies'),
    assetFamilies: asUniqueStringArray(value.assetFamilies ?? [], sourceLabel, 'include.assetFamilies'),
    eventFamilies: asUniqueStringArray(value.eventFamilies ?? [], sourceLabel, 'include.eventFamilies'),
    cohortFamilies: asUniqueStringArray(value.cohortFamilies ?? [], sourceLabel, 'include.cohortFamilies')
  };
}

function validateCompletionRules(value: unknown, sourceLabel: string): CrossSwarmDefinition['completionRules'] {
  if (!isRecord(value)) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} completionRules must be an object.`);
  }

  const requireAllLinkedSwarmsComplete = asBoolean(value.requireAllLinkedSwarmsComplete);
  const requireNoBlockedSwarms = asBoolean(value.requireNoBlockedSwarms);
  const requireNoUnresolvedConflicts = asBoolean(value.requireNoUnresolvedConflicts);
  const requireCoherentReadiness = asBoolean(value.requireCoherentReadiness);

  if (
    requireAllLinkedSwarmsComplete === null
    || requireNoBlockedSwarms === null
    || requireNoUnresolvedConflicts === null
    || requireCoherentReadiness === null
  ) {
    throw new CrossSwarmError(
      'CROSS_SWARM_INVALID_DEFINITION',
      `Cross-swarm definition ${sourceLabel} completionRules must provide boolean requireAllLinkedSwarmsComplete/requireNoBlockedSwarms/requireNoUnresolvedConflicts/requireCoherentReadiness.`
    );
  }

  return {
    requireAllLinkedSwarmsComplete,
    requireNoBlockedSwarms,
    requireNoUnresolvedConflicts,
    requireCoherentReadiness
  };
}

export function validateCrossSwarmDefinition(value: unknown, sourceLabel = '<inline>'): CrossSwarmDefinition {
  if (!isRecord(value)) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} must be an object.`);
  }

  const crossSwarmId = asTrimmedString(value.crossSwarmId);
  const displayName = asTrimmedString(value.displayName);
  const groupType = asGroupType(value.groupType, sourceLabel);
  const enabled = asBoolean(value.enabled);
  const scope = validateScope(value.scope, sourceLabel);
  const include = validateInclude(value.include, sourceLabel);
  const requiredMatchDimensions = asMatchDimensionArray(value.requiredMatchDimensions, sourceLabel);
  const completionRules = validateCompletionRules(value.completionRules, sourceLabel);

  if (!crossSwarmId) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} crossSwarmId must be a non-empty string.`);
  }
  if (!displayName) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} displayName must be a non-empty string.`);
  }
  if (enabled === null) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} enabled must be a boolean.`);
  }
  if (requiredMatchDimensions.length === 0) {
    throw new CrossSwarmError('CROSS_SWARM_INVALID_DEFINITION', `Cross-swarm definition ${sourceLabel} requiredMatchDimensions must not be empty.`);
  }

  return {
    crossSwarmId,
    displayName,
    groupType,
    enabled,
    scope,
    include,
    requiredMatchDimensions,
    completionRules
  };
}

export function loadCrossSwarmDefinitions(options: { definitionsDir?: string } = {}): CrossSwarmDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_CROSS_SWARM_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new CrossSwarmError('CROSS_SWARM_DEFINITIONS_NOT_FOUND', `Cross-swarm definitions directory not found: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validateCrossSwarmDefinition(parsed, entry);
    })
    .sort((left, right) => left.crossSwarmId.localeCompare(right.crossSwarmId));
}

export function createCrossSwarmRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadCrossSwarmDefinitions({ definitionsDir: options.definitionsDir });
  const byId = new Map<string, CrossSwarmDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.crossSwarmId)) {
      throw new CrossSwarmError('CROSS_SWARM_DUPLICATE_DEFINITION', `Duplicate crossSwarmId detected: ${definition.crossSwarmId}`);
    }
    byId.set(definition.crossSwarmId, definition);
  }

  function listDefinitions(): CrossSwarmDefinition[] {
    return Array.from(byId.values()).sort((left, right) => left.crossSwarmId.localeCompare(right.crossSwarmId));
  }

  function getDefinition(crossSwarmId: string): CrossSwarmDefinition {
    const found = byId.get(crossSwarmId);
    if (!found) {
      throw new CrossSwarmError('CROSS_SWARM_NOT_FOUND', `Cross-swarm definition not found: ${crossSwarmId}`);
    }
    return found;
  }

  return {
    listDefinitions,
    getDefinition
  };
}

export type CrossSwarmRegistry = ReturnType<typeof createCrossSwarmRegistry>;
