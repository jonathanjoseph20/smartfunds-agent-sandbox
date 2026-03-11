import fs from 'node:fs';
import path from 'node:path';

import {
  ActionPlanError,
  type ActionPlanDefinition,
} from './action-plan-types.ts';

export const DEFAULT_ACTION_PLAN_DEFINITIONS_DIR = 'control-plane/action-orchestration/definitions';

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
    throw new ActionPlanError(
      'ACTION_PLAN_INVALID_DEFINITION',
      `Action plan definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`
    );
  }

  const normalized = value.map((entry) => asTrimmedString(entry));
  if (normalized.some((entry) => !entry)) {
    throw new ActionPlanError(
      'ACTION_PLAN_INVALID_DEFINITION',
      `Action plan definition ${sourceLabel} ${fieldName} must be an array of non-empty strings.`
    );
  }

  return Array.from(new Set(normalized as string[])).sort((left, right) => left.localeCompare(right));
}

function validateMatchingRules(value: unknown, sourceLabel: string): ActionPlanDefinition['matchingRules'] {
  if (!isRecord(value)) {
    throw new ActionPlanError(
      'ACTION_PLAN_INVALID_DEFINITION',
      `Action plan definition ${sourceLabel} matchingRules must be an object.`
    );
  }

  const routeCategories = value.routeCategories === undefined
    ? undefined
    : asUniqueStringArray(value.routeCategories, sourceLabel, 'matchingRules.routeCategories');

  const riskThemes = value.riskThemes === undefined
    ? undefined
    : asUniqueStringArray(value.riskThemes, sourceLabel, 'matchingRules.riskThemes');

  return {
    ...(routeCategories ? { routeCategories } : {}),
    ...(riskThemes ? { riskThemes } : {}),
  };
}

export function validateActionPlanDefinition(value: unknown, sourceLabel = '<inline>'): ActionPlanDefinition {
  if (!isRecord(value)) {
    throw new ActionPlanError(
      'ACTION_PLAN_INVALID_DEFINITION',
      `Action plan definition ${sourceLabel} must be an object.`
    );
  }

  const actionPlanId = asTrimmedString(value.actionPlanId);
  const displayName = asTrimmedString(value.displayName);
  const planType = asTrimmedString(value.planType);
  const enabled = asBoolean(value.enabled);
  const matchingRules = validateMatchingRules(value.matchingRules, sourceLabel);

  if (!actionPlanId) {
    throw new ActionPlanError(
      'ACTION_PLAN_INVALID_DEFINITION',
      `Action plan definition ${sourceLabel} actionPlanId must be a non-empty string.`
    );
  }

  if (!displayName) {
    throw new ActionPlanError(
      'ACTION_PLAN_INVALID_DEFINITION',
      `Action plan definition ${sourceLabel} displayName must be a non-empty string.`
    );
  }

  if (!planType) {
    throw new ActionPlanError(
      'ACTION_PLAN_INVALID_DEFINITION',
      `Action plan definition ${sourceLabel} planType must be a non-empty string.`
    );
  }

  if (enabled === null) {
    throw new ActionPlanError(
      'ACTION_PLAN_INVALID_DEFINITION',
      `Action plan definition ${sourceLabel} enabled must be a boolean.`
    );
  }

  return {
    actionPlanId,
    displayName,
    planType,
    enabled,
    matchingRules,
  };
}

export function loadActionPlanDefinitions(options: { definitionsDir?: string } = {}): ActionPlanDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_ACTION_PLAN_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new ActionPlanError(
      'ACTION_PLAN_DEFINITIONS_NOT_FOUND',
      `Action plan definitions directory not found: ${definitionsDir}`
    );
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validateActionPlanDefinition(parsed, entry);
    })
    .sort((left, right) => left.actionPlanId.localeCompare(right.actionPlanId));
}

export function createActionPlanRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadActionPlanDefinitions({ definitionsDir: options.definitionsDir });
  const byId = new Map<string, ActionPlanDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.actionPlanId)) {
      throw new ActionPlanError(
        'ACTION_PLAN_DUPLICATE_DEFINITION',
        `Duplicate actionPlanId detected: ${definition.actionPlanId}`
      );
    }

    byId.set(definition.actionPlanId, definition);
  }

  function getActionPlanDefinitions(): ActionPlanDefinition[] {
    return Array.from(byId.values()).sort((left, right) => left.actionPlanId.localeCompare(right.actionPlanId));
  }

  function getActionPlanDefinitionById(actionPlanId: string): ActionPlanDefinition {
    const found = byId.get(actionPlanId);
    if (!found) {
      throw new ActionPlanError('ACTION_PLAN_NOT_FOUND', `Action plan definition not found: ${actionPlanId}`);
    }

    return found;
  }

  return {
    getActionPlanDefinitions,
    getActionPlanDefinitionById,
  };
}

export type ActionPlanRegistry = ReturnType<typeof createActionPlanRegistry>;
