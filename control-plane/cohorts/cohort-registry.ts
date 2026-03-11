import fs from 'node:fs';
import path from 'node:path';

import {
  CohortError,
  type CohortDefinition,
  type CohortLinkRules,
} from './cohort-types.ts';

export const DEFAULT_COHORT_DEFINITIONS_DIR = 'control-plane/cohorts/definitions';

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
  if (typeof value !== 'boolean') {
    return null;
  }
  return value;
}

function validateLinkRules(value: unknown, sourceLabel: string): CohortLinkRules {
  if (!isRecord(value)) {
    throw new CohortError('COHORT_INVALID_DEFINITION', `Cohort definition ${sourceLabel} linkRules must be an object.`);
  }

  const sharedProtocol = asBoolean(value.sharedProtocol);
  const sharedAsset = asBoolean(value.sharedAsset);
  const sharedEventFamily = asBoolean(value.sharedEventFamily);
  const sharedTriggerFamily = asBoolean(value.sharedTriggerFamily);
  const cohortDefinitionMatch = asBoolean(value.cohortDefinitionMatch);

  if (sharedProtocol === null || sharedAsset === null || sharedEventFamily === null || sharedTriggerFamily === null || cohortDefinitionMatch === null) {
    throw new CohortError(
      'COHORT_INVALID_DEFINITION',
      `Cohort definition ${sourceLabel} linkRules must provide boolean sharedProtocol/sharedAsset/sharedEventFamily/sharedTriggerFamily/cohortDefinitionMatch.`
    );
  }

  return {
    sharedProtocol,
    sharedAsset,
    sharedEventFamily,
    sharedTriggerFamily,
    cohortDefinitionMatch
  };
}

export function validateCohortDefinition(value: unknown, sourceLabel = '<inline>'): CohortDefinition {
  if (!isRecord(value)) {
    throw new CohortError('COHORT_INVALID_DEFINITION', `Cohort definition ${sourceLabel} must be an object.`);
  }

  const cohortId = asTrimmedString(value.cohortId);
  const cohortType = asTrimmedString(value.cohortType);
  const subjectKey = asTrimmedString(value.subjectKey);
  const linkRules = validateLinkRules(value.linkRules, sourceLabel);

  if (!cohortId) {
    throw new CohortError('COHORT_INVALID_DEFINITION', `Cohort definition ${sourceLabel} cohortId must be a non-empty string.`);
  }
  if (!cohortType) {
    throw new CohortError('COHORT_INVALID_DEFINITION', `Cohort definition ${cohortId} cohortType must be a non-empty string.`);
  }
  if (!subjectKey) {
    throw new CohortError('COHORT_INVALID_DEFINITION', `Cohort definition ${cohortId} subjectKey must be a non-empty string.`);
  }

  return {
    cohortId,
    cohortType,
    subjectKey,
    linkRules
  };
}

export function loadCohortDefinitions(options: { definitionsDir?: string } = {}): CohortDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_COHORT_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new CohortError('COHORT_DEFINITIONS_NOT_FOUND', `Cohort definitions directory not found: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validateCohortDefinition(parsed, entry);
    })
    .sort((left, right) => left.cohortId.localeCompare(right.cohortId));
}

export function createCohortRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadCohortDefinitions({ definitionsDir: options.definitionsDir });
  const byId = new Map<string, CohortDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.cohortId)) {
      throw new CohortError('COHORT_DUPLICATE_DEFINITION', `Duplicate cohortId detected: ${definition.cohortId}`);
    }
    byId.set(definition.cohortId, definition);
  }

  function getCohortDefinition(cohortId: string): CohortDefinition {
    const found = byId.get(cohortId);
    if (!found) {
      throw new CohortError('COHORT_DEFINITION_NOT_FOUND', `Cohort definition not found: ${cohortId}`);
    }
    return found;
  }

  function listCohorts(): CohortDefinition[] {
    return Array.from(byId.values()).sort((left, right) => left.cohortId.localeCompare(right.cohortId));
  }

  return {
    getCohortDefinition,
    listCohorts
  };
}

export type CohortRegistry = ReturnType<typeof createCohortRegistry>;

export function getCohortDefinition(cohortId: string, options: { definitionsDir?: string } = {}): CohortDefinition {
  return createCohortRegistry(options).getCohortDefinition(cohortId);
}

export function listCohorts(options: { definitionsDir?: string } = {}): CohortDefinition[] {
  return createCohortRegistry(options).listCohorts();
}
