import fs from 'node:fs';
import path from 'node:path';

import type { SignalDefinition, SignalPrimitiveType } from './signal-types.ts';
import { SignalError } from './signal-types.ts';

const REQUIRED_DEDUP_RULES = ['signalType', 'dataset', 'slot'] as const;

export const DEFAULT_SIGNAL_DEFINITIONS_DIR = 'control-plane/signals/definitions';

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

function assertPrimitiveType(value: unknown, label: string): asserts value is SignalPrimitiveType {
  if (value !== 'string' && value !== 'number' && value !== 'boolean') {
    throw new SignalError('SIGNAL_INVALID_DEFINITION', `${label} must be one of: string, number, boolean.`);
  }
}

function validateDefinition(value: unknown, sourceLabel: string): SignalDefinition {
  if (!isRecord(value)) {
    throw new SignalError('SIGNAL_INVALID_DEFINITION', `Signal definition ${sourceLabel} must be an object.`);
  }

  const signalType = asTrimmedString(value.signalType);
  const description = asTrimmedString(value.description);
  const sourceMission = asTrimmedString(value.sourceMission);

  if (!signalType) {
    throw new SignalError('SIGNAL_INVALID_DEFINITION', `Signal definition ${sourceLabel} signalType must be a non-empty string.`);
  }
  if (!description) {
    throw new SignalError('SIGNAL_INVALID_DEFINITION', `Signal definition ${signalType} description must be a non-empty string.`);
  }
  if (!sourceMission) {
    throw new SignalError('SIGNAL_INVALID_DEFINITION', `Signal definition ${signalType} sourceMission must be a non-empty string.`);
  }

  if (!isRecord(value.schema)) {
    throw new SignalError('SIGNAL_INVALID_DEFINITION', `Signal definition ${signalType} schema must be an object.`);
  }

  const schemaEntries = Object.entries(value.schema)
    .sort(([left], [right]) => left.localeCompare(right));

  if (schemaEntries.length === 0) {
    throw new SignalError('SIGNAL_INVALID_DEFINITION', `Signal definition ${signalType} schema must include at least one key.`);
  }

  const schema: Record<string, SignalPrimitiveType> = {};
  for (const [key, entry] of schemaEntries) {
    const normalizedKey = asTrimmedString(key);
    if (!normalizedKey) {
      throw new SignalError('SIGNAL_INVALID_DEFINITION', `Signal definition ${signalType} schema keys must be non-empty strings.`);
    }
    assertPrimitiveType(entry, `Signal definition ${signalType} schema.${normalizedKey}`);
    schema[normalizedKey] = entry;
  }

  if (!Array.isArray(value.deduplicationRules) || !value.deduplicationRules.every((entry) => typeof entry === 'string')) {
    throw new SignalError('SIGNAL_INVALID_DEFINITION', `Signal definition ${signalType} deduplicationRules must be an array of strings.`);
  }

  const rules = value.deduplicationRules.map((entry) => String(entry).trim());
  if (rules.length !== REQUIRED_DEDUP_RULES.length) {
    throw new SignalError('SIGNAL_INVALID_DEFINITION', `Signal definition ${signalType} deduplicationRules must equal ${REQUIRED_DEDUP_RULES.join(', ')}.`);
  }
  for (let index = 0; index < REQUIRED_DEDUP_RULES.length; index += 1) {
    if (rules[index] !== REQUIRED_DEDUP_RULES[index]) {
      throw new SignalError('SIGNAL_INVALID_DEFINITION', `Signal definition ${signalType} deduplicationRules must equal ${REQUIRED_DEDUP_RULES.join(', ')}.`);
    }
  }

  return {
    signalType,
    description,
    sourceMission,
    schema,
    deduplicationRules: [...REQUIRED_DEDUP_RULES]
  };
}

function loadJsonDefinitions(dir: string): SignalDefinition[] {
  const resolvedDir = path.resolve(dir);
  if (!fs.existsSync(resolvedDir)) {
    throw new SignalError('SIGNAL_DEFINITIONS_NOT_FOUND', `Signal definitions directory not found: ${dir}`);
  }

  const files = fs.readdirSync(resolvedDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files.map((entry) => {
    const filePath = path.join(resolvedDir, entry);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return validateDefinition(parsed, entry);
  });
}

function valueMatchesType(value: unknown, expected: SignalPrimitiveType): boolean {
  if (expected === 'string') {
    return typeof value === 'string';
  }
  if (expected === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }
  return typeof value === 'boolean';
}

export function createSignalRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadJsonDefinitions(options.definitionsDir ?? DEFAULT_SIGNAL_DEFINITIONS_DIR);
  const map = new Map<string, SignalDefinition>();

  for (const definition of definitions) {
    if (map.has(definition.signalType)) {
      throw new SignalError('SIGNAL_DUPLICATE_DEFINITION', `Duplicate signalType detected: ${definition.signalType}`);
    }
    map.set(definition.signalType, definition);
  }

  function getSignalDefinition(signalType: string): SignalDefinition {
    const found = map.get(signalType);
    if (!found) {
      throw new SignalError('SIGNAL_UNKNOWN_TYPE', `Signal definition not found: ${signalType}`);
    }
    return found;
  }

  function listSignalTypes(): string[] {
    return Array.from(map.keys()).sort((left, right) => left.localeCompare(right));
  }

  function validateSignalPayload(signalType: string, payload: unknown): Record<string, unknown> {
    const definition = getSignalDefinition(signalType);
    if (!isRecord(payload)) {
      throw new SignalError('SIGNAL_INVALID_PAYLOAD', `Signal payload for ${signalType} must be an object.`);
    }

    const normalized: Record<string, unknown> = {};
    for (const [key, type] of Object.entries(definition.schema).sort(([left], [right]) => left.localeCompare(right))) {
      if (!(key in payload)) {
        throw new SignalError('SIGNAL_INVALID_PAYLOAD', `Signal payload for ${signalType} missing required key: ${key}`);
      }
      const value = payload[key];
      if (!valueMatchesType(value, type)) {
        throw new SignalError('SIGNAL_INVALID_PAYLOAD', `Signal payload for ${signalType} key ${key} must be type ${type}.`);
      }
      normalized[key] = value;
    }

    for (const [key, value] of Object.entries(payload).sort(([left], [right]) => left.localeCompare(right))) {
      if (!(key in normalized)) {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  return {
    getSignalDefinition,
    listSignalTypes,
    validateSignalPayload
  };
}

export type SignalRegistry = ReturnType<typeof createSignalRegistry>;
