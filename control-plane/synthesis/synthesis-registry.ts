import fs from 'node:fs';
import path from 'node:path';

import {
  SYNTHESIS_DIMENSIONS,
  SynthesisError,
  type SynthesisDefinition,
  type SynthesisDimension
} from './synthesis-types.ts';

export const DEFAULT_SYNTHESIS_DEFINITIONS_DIR = 'control-plane/synthesis/definitions';

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

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized = value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => entry !== null);

  if (normalized.length !== value.length) {
    return null;
  }

  return Array.from(new Set(normalized)).sort((left, right) => left.localeCompare(right));
}

function asDimensionArray(value: unknown): SynthesisDimension[] | null {
  const parsed = asStringArray(value);
  if (!parsed) {
    return null;
  }
  if (parsed.some((entry) => !SYNTHESIS_DIMENSIONS.includes(entry as SynthesisDimension))) {
    return null;
  }
  return parsed as SynthesisDimension[];
}

export function validateSynthesisDefinition(value: unknown, sourceLabel = '<inline>'): SynthesisDefinition {
  if (!isRecord(value)) {
    throw new SynthesisError('SYNTHESIS_INVALID_DEFINITION', `Synthesis definition ${sourceLabel} must be an object.`);
  }

  const synthesisType = asTrimmedString(value.synthesisType);
  const description = asTrimmedString(value.description);
  const supportedDimensions = asDimensionArray(value.supportedDimensions);
  const sourceSignalTypes = asStringArray(value.sourceSignalTypes);
  const sourceInvestigationDefinitionIds = asStringArray(value.sourceInvestigationDefinitionIds);

  if (!synthesisType) {
    throw new SynthesisError('SYNTHESIS_INVALID_DEFINITION', `Synthesis definition ${sourceLabel} synthesisType must be a non-empty string.`);
  }
  if (!description) {
    throw new SynthesisError('SYNTHESIS_INVALID_DEFINITION', `Synthesis definition ${synthesisType} description must be a non-empty string.`);
  }
  if (!supportedDimensions || supportedDimensions.length === 0) {
    throw new SynthesisError('SYNTHESIS_INVALID_DEFINITION', `Synthesis definition ${synthesisType} supportedDimensions must be a non-empty array.`);
  }
  if (!sourceSignalTypes || sourceSignalTypes.length === 0) {
    throw new SynthesisError('SYNTHESIS_INVALID_DEFINITION', `Synthesis definition ${synthesisType} sourceSignalTypes must be a non-empty array.`);
  }
  if (!sourceInvestigationDefinitionIds || sourceInvestigationDefinitionIds.length === 0) {
    throw new SynthesisError('SYNTHESIS_INVALID_DEFINITION', `Synthesis definition ${synthesisType} sourceInvestigationDefinitionIds must be a non-empty array.`);
  }

  return {
    synthesisType,
    description,
    supportedDimensions,
    sourceSignalTypes,
    sourceInvestigationDefinitionIds
  };
}

export function loadSynthesisDefinitions(options: { definitionsDir?: string } = {}): SynthesisDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_SYNTHESIS_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new SynthesisError('SYNTHESIS_DEFINITIONS_NOT_FOUND', `Synthesis definitions directory not found: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const filePath = path.join(definitionsDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return validateSynthesisDefinition(parsed, entry);
    })
    .sort((left, right) => left.synthesisType.localeCompare(right.synthesisType));
}

export function createSynthesisRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadSynthesisDefinitions({ definitionsDir: options.definitionsDir });
  const byType = new Map<string, SynthesisDefinition>();

  for (const definition of definitions) {
    if (byType.has(definition.synthesisType)) {
      throw new SynthesisError('SYNTHESIS_DUPLICATE_DEFINITION', `Duplicate synthesisType detected: ${definition.synthesisType}`);
    }
    byType.set(definition.synthesisType, definition);
  }

  function listDefinitions(): SynthesisDefinition[] {
    return Array.from(byType.values()).sort((left, right) => left.synthesisType.localeCompare(right.synthesisType));
  }

  function getDefinition(synthesisType: string): SynthesisDefinition {
    const found = byType.get(synthesisType);
    if (!found) {
      throw new SynthesisError('SYNTHESIS_DEFINITION_NOT_FOUND', `Synthesis definition not found: ${synthesisType}`);
    }
    return found;
  }

  function listBySignalType(signalType: string): SynthesisDefinition[] {
    return listDefinitions().filter((definition) => definition.sourceSignalTypes.includes(signalType));
  }

  function listByInvestigationDefinition(investigationDefinitionId: string): SynthesisDefinition[] {
    return listDefinitions().filter((definition) => (
      definition.sourceInvestigationDefinitionIds.includes(investigationDefinitionId)
    ));
  }

  return {
    listDefinitions,
    getDefinition,
    listBySignalType,
    listByInvestigationDefinition
  };
}

export type SynthesisRegistry = ReturnType<typeof createSynthesisRegistry>;
