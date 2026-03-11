import fs from 'node:fs';
import path from 'node:path';

import {
  PortfolioActionError,
  type PortfolioActionDefinition,
} from './portfolio-action-types.ts';

export const DEFAULT_PORTFOLIO_ACTION_DEFINITIONS_DIR = 'control-plane/portfolio-actions/definitions';

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
    throw new PortfolioActionError(
      'PORTFOLIO_ACTION_INVALID_DEFINITION',
      `Portfolio action definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`
    );
  }

  const normalized = value.map((entry) => asTrimmedString(entry));
  if (normalized.some((entry) => !entry)) {
    throw new PortfolioActionError(
      'PORTFOLIO_ACTION_INVALID_DEFINITION',
      `Portfolio action definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`
    );
  }

  return Array.from(new Set(normalized as string[])).sort((left, right) => left.localeCompare(right));
}

function validatePortfolioMatchRules(
  value: unknown,
  sourceLabel: string,
): PortfolioActionDefinition['portfolioMatchRules'] {
  if (!isRecord(value)) {
    throw new PortfolioActionError(
      'PORTFOLIO_ACTION_INVALID_DEFINITION',
      `Portfolio action definition ${sourceLabel} portfolioMatchRules must be an object.`
    );
  }

  const riskThemes = value.riskThemes === undefined
    ? undefined
    : asUniqueStringArray(value.riskThemes, sourceLabel, 'portfolioMatchRules.riskThemes');

  const exposureFlags = value.exposureFlags === undefined
    ? undefined
    : asUniqueStringArray(value.exposureFlags, sourceLabel, 'portfolioMatchRules.exposureFlags');

  const concentrationWarnings = value.concentrationWarnings === undefined
    ? undefined
    : asUniqueStringArray(value.concentrationWarnings, sourceLabel, 'portfolioMatchRules.concentrationWarnings');

  const marketEventFamilies = value.marketEventFamilies === undefined
    ? undefined
    : asUniqueStringArray(value.marketEventFamilies, sourceLabel, 'portfolioMatchRules.marketEventFamilies');

  return {
    ...(riskThemes ? { riskThemes } : {}),
    ...(exposureFlags ? { exposureFlags } : {}),
    ...(concentrationWarnings ? { concentrationWarnings } : {}),
    ...(marketEventFamilies ? { marketEventFamilies } : {}),
  };
}

function asOptionalRules(value: unknown, sourceLabel: string, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return asUniqueStringArray(value, sourceLabel, fieldName);
}

export function validatePortfolioActionDefinition(value: unknown, sourceLabel = '<inline>'): PortfolioActionDefinition {
  if (!isRecord(value)) {
    throw new PortfolioActionError(
      'PORTFOLIO_ACTION_INVALID_DEFINITION',
      `Portfolio action definition ${sourceLabel} must be an object.`
    );
  }

  const actionId = asTrimmedString(value.actionId);
  const displayName = asTrimmedString(value.displayName);
  const actionType = asTrimmedString(value.actionType);
  const enabled = asBoolean(value.enabled);
  const portfolioMatchRules = validatePortfolioMatchRules(value.portfolioMatchRules, sourceLabel);
  const readinessRules = asOptionalRules(value.readinessRules, sourceLabel, 'readinessRules');
  const blockingRules = asOptionalRules(value.blockingRules, sourceLabel, 'blockingRules');
  const priorityRules = asOptionalRules(value.priorityRules, sourceLabel, 'priorityRules');

  if (!actionId) {
    throw new PortfolioActionError(
      'PORTFOLIO_ACTION_INVALID_DEFINITION',
      `Portfolio action definition ${sourceLabel} actionId must be a non-empty string.`
    );
  }
  if (!displayName) {
    throw new PortfolioActionError(
      'PORTFOLIO_ACTION_INVALID_DEFINITION',
      `Portfolio action definition ${sourceLabel} displayName must be a non-empty string.`
    );
  }
  if (!actionType) {
    throw new PortfolioActionError(
      'PORTFOLIO_ACTION_INVALID_DEFINITION',
      `Portfolio action definition ${sourceLabel} actionType must be a non-empty string.`
    );
  }
  if (enabled === null) {
    throw new PortfolioActionError(
      'PORTFOLIO_ACTION_INVALID_DEFINITION',
      `Portfolio action definition ${sourceLabel} enabled must be a boolean.`
    );
  }

  return {
    actionId,
    displayName,
    actionType,
    enabled,
    portfolioMatchRules,
    ...(readinessRules ? { readinessRules } : {}),
    ...(blockingRules ? { blockingRules } : {}),
    ...(priorityRules ? { priorityRules } : {}),
  };
}

export function loadActionDefinitions(options: { definitionsDir?: string } = {}): PortfolioActionDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_PORTFOLIO_ACTION_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new PortfolioActionError(
      'PORTFOLIO_ACTION_DEFINITIONS_NOT_FOUND',
      `Portfolio action definitions directory not found: ${definitionsDir}`
    );
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validatePortfolioActionDefinition(parsed, entry);
    })
    .sort((left, right) => left.actionId.localeCompare(right.actionId));
}

export function createPortfolioActionRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadActionDefinitions({ definitionsDir: options.definitionsDir });
  const byId = new Map<string, PortfolioActionDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.actionId)) {
      throw new PortfolioActionError(
        'PORTFOLIO_ACTION_DUPLICATE_DEFINITION',
        `Duplicate actionId detected: ${definition.actionId}`
      );
    }
    byId.set(definition.actionId, definition);
  }

  function getActionDefinitions(): PortfolioActionDefinition[] {
    return Array.from(byId.values()).sort((left, right) => left.actionId.localeCompare(right.actionId));
  }

  function getActionDefinitionById(actionId: string): PortfolioActionDefinition {
    const found = byId.get(actionId);
    if (!found) {
      throw new PortfolioActionError('PORTFOLIO_ACTION_NOT_FOUND', `Portfolio action definition not found: ${actionId}`);
    }
    return found;
  }

  return {
    getActionDefinitions,
    getActionDefinitionById,
  };
}

export type PortfolioActionRegistry = ReturnType<typeof createPortfolioActionRegistry>;
