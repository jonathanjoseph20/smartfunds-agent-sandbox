import fs from 'node:fs';
import path from 'node:path';

import {
  MarketSynthesisError,
  type MarketSynthesisDefinition,
} from './market-synthesis-types.ts';

export const DEFAULT_MARKET_SYNTHESIS_DEFINITIONS_DIR = 'control-plane/market-synthesis/definitions';

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
    throw new MarketSynthesisError(
      'MARKET_SYNTHESIS_INVALID_DEFINITION',
      `Market synthesis definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`
    );
  }

  const normalized = value.map((entry) => asTrimmedString(entry));
  if (normalized.some((entry) => !entry)) {
    throw new MarketSynthesisError(
      'MARKET_SYNTHESIS_INVALID_DEFINITION',
      `Market synthesis definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`
    );
  }

  return Array.from(new Set(normalized as string[])).sort((left, right) => left.localeCompare(right));
}

function validateMatchingRules(
  value: unknown,
  sourceLabel: string
): MarketSynthesisDefinition['crossSwarmMatchingRules'] {
  if (!isRecord(value)) {
    throw new MarketSynthesisError(
      'MARKET_SYNTHESIS_INVALID_DEFINITION',
      `Market synthesis definition ${sourceLabel} crossSwarmMatchingRules must be an object.`
    );
  }

  const eventFamilies = value.eventFamilies === undefined
    ? undefined
    : asUniqueStringArray(value.eventFamilies, sourceLabel, 'crossSwarmMatchingRules.eventFamilies');

  const protocolFamilies = value.protocolFamilies === undefined
    ? undefined
    : asUniqueStringArray(value.protocolFamilies, sourceLabel, 'crossSwarmMatchingRules.protocolFamilies');

  const assetFamilies = value.assetFamilies === undefined
    ? undefined
    : asUniqueStringArray(value.assetFamilies, sourceLabel, 'crossSwarmMatchingRules.assetFamilies');

  const responseFamilies = value.responseFamilies === undefined
    ? undefined
    : asUniqueStringArray(value.responseFamilies, sourceLabel, 'crossSwarmMatchingRules.responseFamilies');

  return {
    ...(eventFamilies ? { eventFamilies } : {}),
    ...(protocolFamilies ? { protocolFamilies } : {}),
    ...(assetFamilies ? { assetFamilies } : {}),
    ...(responseFamilies ? { responseFamilies } : {})
  };
}

function validateScopeConstraints(
  value: unknown,
  sourceLabel: string
): MarketSynthesisDefinition['scopeConstraints'] {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new MarketSynthesisError(
      'MARKET_SYNTHESIS_INVALID_DEFINITION',
      `Market synthesis definition ${sourceLabel} scopeConstraints must be an object.`
    );
  }

  if (value.minCrossSwarms === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value.minCrossSwarms) || (value.minCrossSwarms as number) < 0) {
    throw new MarketSynthesisError(
      'MARKET_SYNTHESIS_INVALID_DEFINITION',
      `Market synthesis definition ${sourceLabel} scopeConstraints.minCrossSwarms must be a non-negative integer.`
    );
  }

  return { minCrossSwarms: value.minCrossSwarms as number };
}

export function validateMarketSynthesisDefinition(
  value: unknown,
  sourceLabel = '<inline>'
): MarketSynthesisDefinition {
  if (!isRecord(value)) {
    throw new MarketSynthesisError('MARKET_SYNTHESIS_INVALID_DEFINITION', `Market synthesis definition ${sourceLabel} must be an object.`);
  }

  const marketSynthesisId = asTrimmedString(value.marketSynthesisId);
  const displayName = asTrimmedString(value.displayName);
  const synthesisType = asTrimmedString(value.synthesisType);
  const enabled = asBoolean(value.enabled);
  const crossSwarmMatchingRules = validateMatchingRules(value.crossSwarmMatchingRules, sourceLabel);
  const scopeConstraints = validateScopeConstraints(value.scopeConstraints, sourceLabel);

  if (!marketSynthesisId) {
    throw new MarketSynthesisError(
      'MARKET_SYNTHESIS_INVALID_DEFINITION',
      `Market synthesis definition ${sourceLabel} marketSynthesisId must be a non-empty string.`
    );
  }
  if (!displayName) {
    throw new MarketSynthesisError(
      'MARKET_SYNTHESIS_INVALID_DEFINITION',
      `Market synthesis definition ${sourceLabel} displayName must be a non-empty string.`
    );
  }
  if (!synthesisType) {
    throw new MarketSynthesisError(
      'MARKET_SYNTHESIS_INVALID_DEFINITION',
      `Market synthesis definition ${sourceLabel} synthesisType must be a non-empty string.`
    );
  }
  if (enabled === null) {
    throw new MarketSynthesisError(
      'MARKET_SYNTHESIS_INVALID_DEFINITION',
      `Market synthesis definition ${sourceLabel} enabled must be a boolean.`
    );
  }

  return {
    marketSynthesisId,
    displayName,
    synthesisType,
    enabled,
    crossSwarmMatchingRules,
    ...(scopeConstraints ? { scopeConstraints } : {})
  };
}

export function loadMarketSynthesisDefinitions(options: { definitionsDir?: string } = {}): MarketSynthesisDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_MARKET_SYNTHESIS_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new MarketSynthesisError(
      'MARKET_SYNTHESIS_DEFINITIONS_NOT_FOUND',
      `Market synthesis definitions directory not found: ${definitionsDir}`
    );
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validateMarketSynthesisDefinition(parsed, entry);
    })
    .sort((left, right) => left.marketSynthesisId.localeCompare(right.marketSynthesisId));
}

export function createMarketSynthesisRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadMarketSynthesisDefinitions({ definitionsDir: options.definitionsDir });
  const byId = new Map<string, MarketSynthesisDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.marketSynthesisId)) {
      throw new MarketSynthesisError(
        'MARKET_SYNTHESIS_DUPLICATE_DEFINITION',
        `Duplicate marketSynthesisId detected: ${definition.marketSynthesisId}`
      );
    }
    byId.set(definition.marketSynthesisId, definition);
  }

  function listDefinitions(): MarketSynthesisDefinition[] {
    return Array.from(byId.values()).sort((left, right) => left.marketSynthesisId.localeCompare(right.marketSynthesisId));
  }

  function getDefinition(marketSynthesisId: string): MarketSynthesisDefinition {
    const found = byId.get(marketSynthesisId);
    if (!found) {
      throw new MarketSynthesisError('MARKET_SYNTHESIS_NOT_FOUND', `Market synthesis definition not found: ${marketSynthesisId}`);
    }
    return found;
  }

  return {
    listDefinitions,
    getDefinition
  };
}

export type MarketSynthesisRegistry = ReturnType<typeof createMarketSynthesisRegistry>;
