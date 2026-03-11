import fs from 'node:fs';
import path from 'node:path';

import { SwarmError, type SwarmDefinition } from './swarm-types.ts';

export const DEFAULT_SWARM_DEFINITIONS_DIR = 'control-plane/research-swarms/definitions';

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

function asUniqueStringArray(value: unknown, fieldName: string, sourceLabel: string): string[] {
  if (!Array.isArray(value)) {
    throw new SwarmError('SWARM_INVALID_DEFINITION', `Swarm definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`);
  }

  const normalized = value.map((entry) => asTrimmedString(entry));
  if (normalized.some((entry) => !entry)) {
    throw new SwarmError('SWARM_INVALID_DEFINITION', `Swarm definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`);
  }

  return Array.from(new Set(normalized as string[])).sort((left, right) => left.localeCompare(right));
}

export function validateSwarmDefinition(value: unknown, sourceLabel = '<inline>'): SwarmDefinition {
  if (!isRecord(value)) {
    throw new SwarmError('SWARM_INVALID_DEFINITION', `Swarm definition ${sourceLabel} must be an object.`);
  }

  const swarmId = asTrimmedString(value.swarmId);
  const displayName = asTrimmedString(value.displayName);
  const teamId = asTrimmedString(value.teamId);
  const investigationTemplates = asUniqueStringArray(value.investigationTemplates, 'investigationTemplates', sourceLabel);

  if (!swarmId) {
    throw new SwarmError('SWARM_INVALID_DEFINITION', `Swarm definition ${sourceLabel} swarmId must be a non-empty string.`);
  }
  if (!displayName) {
    throw new SwarmError('SWARM_INVALID_DEFINITION', `Swarm definition ${sourceLabel} displayName must be a non-empty string.`);
  }
  if (!teamId) {
    throw new SwarmError('SWARM_INVALID_DEFINITION', `Swarm definition ${sourceLabel} teamId must be a non-empty string.`);
  }
  if (investigationTemplates.length === 0) {
    throw new SwarmError('SWARM_INVALID_DEFINITION', `Swarm definition ${sourceLabel} investigationTemplates must not be empty.`);
  }

  const completionRules = value.completionRules;
  if (!isRecord(completionRules)) {
    throw new SwarmError('SWARM_INVALID_DEFINITION', `Swarm definition ${sourceLabel} completionRules must be an object.`);
  }

  if (typeof completionRules.requireAllInvestigationsComplete !== 'boolean') {
    throw new SwarmError('SWARM_INVALID_DEFINITION', `Swarm definition ${sourceLabel} completionRules.requireAllInvestigationsComplete must be a boolean.`);
  }
  if (typeof completionRules.requireResolvedConflicts !== 'boolean') {
    throw new SwarmError('SWARM_INVALID_DEFINITION', `Swarm definition ${sourceLabel} completionRules.requireResolvedConflicts must be a boolean.`);
  }

  return {
    swarmId,
    displayName,
    teamId,
    investigationTemplates,
    completionRules: {
      requireAllInvestigationsComplete: completionRules.requireAllInvestigationsComplete,
      requireResolvedConflicts: completionRules.requireResolvedConflicts
    }
  };
}

export function loadSwarmDefinitions(options: { definitionsDir?: string } = {}): SwarmDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_SWARM_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new SwarmError('SWARM_DEFINITIONS_NOT_FOUND', `Swarm definitions directory not found: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validateSwarmDefinition(parsed, entry);
    })
    .sort((left, right) => left.swarmId.localeCompare(right.swarmId));
}

export function createSwarmRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadSwarmDefinitions({ definitionsDir: options.definitionsDir });
  const bySwarmId = new Map<string, SwarmDefinition>();

  for (const definition of definitions) {
    if (bySwarmId.has(definition.swarmId)) {
      throw new SwarmError('SWARM_DUPLICATE_DEFINITION', `Duplicate swarmId detected: ${definition.swarmId}`);
    }
    bySwarmId.set(definition.swarmId, definition);
  }

  function getSwarmDefinition(swarmId: string): SwarmDefinition {
    const found = bySwarmId.get(swarmId);
    if (!found) {
      throw new SwarmError('SWARM_NOT_FOUND', `Swarm definition not found: ${swarmId}`);
    }
    return found;
  }

  function listSwarmDefinitions(): SwarmDefinition[] {
    return Array.from(bySwarmId.values()).sort((left, right) => left.swarmId.localeCompare(right.swarmId));
  }

  return {
    getSwarmDefinition,
    listSwarmDefinitions
  };
}

export type SwarmRegistry = ReturnType<typeof createSwarmRegistry>;

export function getSwarmDefinition(swarmId: string, options: { definitionsDir?: string } = {}): SwarmDefinition {
  return createSwarmRegistry(options).getSwarmDefinition(swarmId);
}

export function listSwarmDefinitions(options: { definitionsDir?: string } = {}): SwarmDefinition[] {
  return createSwarmRegistry(options).listSwarmDefinitions();
}
