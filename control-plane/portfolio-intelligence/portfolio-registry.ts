import fs from 'node:fs';
import path from 'node:path';

import {
  PortfolioIntelligenceError,
  type PortfolioDefinition,
} from './portfolio-types.ts';

export const DEFAULT_PORTFOLIO_DEFINITIONS_DIR = 'control-plane/portfolio-intelligence/definitions';

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
    throw new PortfolioIntelligenceError(
      'PORTFOLIO_INVALID_DEFINITION',
      `Portfolio definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`
    );
  }

  const normalized = value.map((entry) => asTrimmedString(entry));
  if (normalized.some((entry) => !entry)) {
    throw new PortfolioIntelligenceError(
      'PORTFOLIO_INVALID_DEFINITION',
      `Portfolio definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`
    );
  }

  return Array.from(new Set(normalized as string[])).sort((left, right) => left.localeCompare(right));
}

function validateMatchingRules(
  value: unknown,
  sourceLabel: string,
): PortfolioDefinition['matchingRules'] {
  if (!isRecord(value)) {
    throw new PortfolioIntelligenceError(
      'PORTFOLIO_INVALID_DEFINITION',
      `Portfolio definition ${sourceLabel} matchingRules must be an object.`
    );
  }

  const protocolFamilies = value.protocolFamilies === undefined
    ? undefined
    : asUniqueStringArray(value.protocolFamilies, sourceLabel, 'matchingRules.protocolFamilies');

  const assetFamilies = value.assetFamilies === undefined
    ? undefined
    : asUniqueStringArray(value.assetFamilies, sourceLabel, 'matchingRules.assetFamilies');

  const eventFamilies = value.eventFamilies === undefined
    ? undefined
    : asUniqueStringArray(value.eventFamilies, sourceLabel, 'matchingRules.eventFamilies');

  const synthesisTypes = value.synthesisTypes === undefined
    ? undefined
    : asUniqueStringArray(value.synthesisTypes, sourceLabel, 'matchingRules.synthesisTypes');

  const marketSynthesisIds = value.marketSynthesisIds === undefined
    ? undefined
    : asUniqueStringArray(value.marketSynthesisIds, sourceLabel, 'matchingRules.marketSynthesisIds');

  return {
    ...(protocolFamilies ? { protocolFamilies } : {}),
    ...(assetFamilies ? { assetFamilies } : {}),
    ...(eventFamilies ? { eventFamilies } : {}),
    ...(synthesisTypes ? { synthesisTypes } : {}),
    ...(marketSynthesisIds ? { marketSynthesisIds } : {})
  };
}

function validateReadinessRules(
  value: unknown,
  sourceLabel: string,
): PortfolioDefinition['readinessRules'] {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new PortfolioIntelligenceError(
      'PORTFOLIO_INVALID_DEFINITION',
      `Portfolio definition ${sourceLabel} readinessRules must be an object.`
    );
  }

  if (value.requireAllLinkedSynthesesReady === undefined) {
    return undefined;
  }

  if (typeof value.requireAllLinkedSynthesesReady !== 'boolean') {
    throw new PortfolioIntelligenceError(
      'PORTFOLIO_INVALID_DEFINITION',
      `Portfolio definition ${sourceLabel} readinessRules.requireAllLinkedSynthesesReady must be a boolean.`
    );
  }

  return {
    requireAllLinkedSynthesesReady: value.requireAllLinkedSynthesesReady
  };
}

export function validatePortfolioDefinition(value: unknown, sourceLabel = '<inline>'): PortfolioDefinition {
  if (!isRecord(value)) {
    throw new PortfolioIntelligenceError('PORTFOLIO_INVALID_DEFINITION', `Portfolio definition ${sourceLabel} must be an object.`);
  }

  const portfolioId = asTrimmedString(value.portfolioId);
  const displayName = asTrimmedString(value.displayName);
  const portfolioType = asTrimmedString(value.portfolioType);
  const enabled = asBoolean(value.enabled);
  const matchingRules = validateMatchingRules(value.matchingRules, sourceLabel);
  const readinessRules = validateReadinessRules(value.readinessRules, sourceLabel);

  if (!portfolioId) {
    throw new PortfolioIntelligenceError(
      'PORTFOLIO_INVALID_DEFINITION',
      `Portfolio definition ${sourceLabel} portfolioId must be a non-empty string.`
    );
  }
  if (!displayName) {
    throw new PortfolioIntelligenceError(
      'PORTFOLIO_INVALID_DEFINITION',
      `Portfolio definition ${sourceLabel} displayName must be a non-empty string.`
    );
  }
  if (!portfolioType) {
    throw new PortfolioIntelligenceError(
      'PORTFOLIO_INVALID_DEFINITION',
      `Portfolio definition ${sourceLabel} portfolioType must be a non-empty string.`
    );
  }
  if (enabled === null) {
    throw new PortfolioIntelligenceError(
      'PORTFOLIO_INVALID_DEFINITION',
      `Portfolio definition ${sourceLabel} enabled must be a boolean.`
    );
  }

  return {
    portfolioId,
    displayName,
    portfolioType,
    enabled,
    matchingRules,
    ...(readinessRules ? { readinessRules } : {})
  };
}

export function loadPortfolioDefinitions(options: { definitionsDir?: string } = {}): PortfolioDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_PORTFOLIO_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new PortfolioIntelligenceError(
      'PORTFOLIO_DEFINITIONS_NOT_FOUND',
      `Portfolio definitions directory not found: ${definitionsDir}`
    );
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validatePortfolioDefinition(parsed, entry);
    })
    .sort((left, right) => left.portfolioId.localeCompare(right.portfolioId));
}

export function createPortfolioRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadPortfolioDefinitions({ definitionsDir: options.definitionsDir });
  const byId = new Map<string, PortfolioDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.portfolioId)) {
      throw new PortfolioIntelligenceError(
        'PORTFOLIO_DUPLICATE_DEFINITION',
        `Duplicate portfolioId detected: ${definition.portfolioId}`
      );
    }
    byId.set(definition.portfolioId, definition);
  }

  function listPortfolioDefinitions(): PortfolioDefinition[] {
    return Array.from(byId.values()).sort((left, right) => left.portfolioId.localeCompare(right.portfolioId));
  }

  function getPortfolioDefinition(portfolioId: string): PortfolioDefinition {
    const found = byId.get(portfolioId);
    if (!found) {
      throw new PortfolioIntelligenceError('PORTFOLIO_NOT_FOUND', `Portfolio definition not found: ${portfolioId}`);
    }
    return found;
  }

  return {
    listPortfolioDefinitions,
    getPortfolioDefinition,
    listDefinitions: listPortfolioDefinitions,
    getDefinition: getPortfolioDefinition,
  };
}

export type PortfolioRegistry = ReturnType<typeof createPortfolioRegistry>;
