import fs from 'node:fs';
import path from 'node:path';

import {
  deriveVentureIdFromDefinition,
  normalizeSemanticStringArray,
  normalizeVentureSlug,
} from './venture-identity.ts';
import {
  buildVentureValidatorReferenceContext,
  isSchemaLevelFinding,
  validateVentureDefinition,
  type VentureValidatorReferenceContext,
} from './venture-validator.ts';
import type {
  VentureDefinition,
  VentureValidationResult,
} from './venture-types.ts';

export const DEFAULT_VENTURE_DEFINITIONS_DIR = 'control-plane/ventures/definitions';

export interface LoadedVenture {
  definition: VentureDefinition;
  validation: VentureValidationResult;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function sortBySemanticKey(left: VentureDefinition, right: VentureDefinition): number {
  const slugCmp = left.ventureSlug.localeCompare(right.ventureSlug);
  if (slugCmp !== 0) {
    return slugCmp;
  }
  return (left.ventureId ?? '').localeCompare(right.ventureId ?? '');
}

function normalizeForRegistry(definition: VentureDefinition): VentureDefinition {
  return {
    ...definition,
    ventureName: definition.ventureName.trim(),
    ventureSlug: normalizeVentureSlug(definition.ventureSlug),
    originMissionIds: normalizeSemanticStringArray(definition.originMissionIds),
    linkedMissionPortfolioIds: normalizeSemanticStringArray(definition.linkedMissionPortfolioIds),
    linkedTeamIds: normalizeSemanticStringArray(definition.linkedTeamIds),
    linkedEntityIds: normalizeSemanticStringArray(definition.linkedEntityIds),
    domainTags: normalizeSemanticStringArray(definition.domainTags),
    productTypeTags: normalizeSemanticStringArray(definition.productTypeTags),
    jurisdictionTags: normalizeSemanticStringArray(definition.jurisdictionTags),
    limitations: normalizeSemanticStringArray(definition.limitations),
    blockingReasons: normalizeSemanticStringArray(definition.blockingReasons),
    provenanceInputs: {
      ...definition.provenanceInputs,
      source: definition.provenanceInputs.source.trim(),
      referenceIds: normalizeSemanticStringArray(definition.provenanceInputs.referenceIds),
      ...(definition.provenanceInputs.notes ? { notes: definition.provenanceInputs.notes.trim() } : {}),
    },
  };
}

function loadValidatedDefinition(input: {
  parsed: unknown;
  context: VentureValidatorReferenceContext;
}): LoadedVenture {
  const validation = validateVentureDefinition(input.parsed, input.context);

  if (validation.findings.some((finding) => isSchemaLevelFinding(finding.code))) {
    throw new Error('INVALID_VENTURE_DEFINITION');
  }

  const normalized = normalizeForRegistry(validation.normalized);
  const derivedVentureId = deriveVentureIdFromDefinition(normalized);

  if (normalized.ventureId && normalized.ventureId !== derivedVentureId) {
    throw new Error('INVALID_VENTURE_DEFINITION');
  }

  const withId: VentureDefinition = {
    ...normalized,
    ventureId: derivedVentureId,
  };

  return {
    definition: withId,
    validation: {
      ...validation,
      ventureId: derivedVentureId,
      normalized: withId,
    },
  };
}

export function loadVentures(options: {
  definitionsDir?: string;
  referenceContext?: VentureValidatorReferenceContext;
} = {}): LoadedVenture[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_VENTURE_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new Error('VENTURE_REGISTRY_EMPTY');
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    throw new Error('VENTURE_REGISTRY_EMPTY');
  }

  const context = options.referenceContext ?? buildVentureValidatorReferenceContext();
  const loaded: LoadedVenture[] = [];

  for (const fileName of files) {
    const parsed = readJson(path.join(definitionsDir, fileName));
    loaded.push(loadValidatedDefinition({ parsed, context }));
  }

  const byVentureId = new Map<string, LoadedVenture>();
  for (const entry of loaded) {
    const ventureId = entry.definition.ventureId ?? '';
    if (byVentureId.has(ventureId)) {
      throw new Error('INVALID_VENTURE_DEFINITION');
    }
    byVentureId.set(ventureId, entry);
  }

  return Array.from(byVentureId.values())
    .sort((left, right) => sortBySemanticKey(left.definition, right.definition));
}

export function createVentureRegistry(options: {
  definitionsDir?: string;
  referenceContext?: VentureValidatorReferenceContext;
} = {}) {
  const entries = loadVentures(options);
  const byId = new Map(entries.map((entry) => [entry.definition.ventureId ?? '', entry]));

  function listVentures(): VentureDefinition[] {
    return Array.from(byId.values())
      .map((entry) => entry.definition)
      .sort(sortBySemanticKey);
  }

  function getVenture(ventureId: string): VentureDefinition {
    const found = byId.get(ventureId.trim());
    if (!found) {
      throw new Error('VENTURE_NOT_FOUND');
    }
    return found.definition;
  }

  function getValidation(ventureId: string): VentureValidationResult {
    const found = byId.get(ventureId.trim());
    if (!found) {
      throw new Error('VENTURE_NOT_FOUND');
    }
    return found.validation;
  }

  return {
    listVentures,
    getVenture,
    getValidation,
  };
}

export type VentureRegistry = ReturnType<typeof createVentureRegistry>;
