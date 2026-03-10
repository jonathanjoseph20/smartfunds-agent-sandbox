import fs from 'node:fs';
import path from 'node:path';

import type { TriggerDefinition } from './trigger-types.ts';
import { TriggerError } from './trigger-types.ts';

export const DEFAULT_TRIGGER_DEFINITIONS_DIR = 'control-plane/triggers/definitions';

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

export function validateTriggerDefinition(value: unknown, sourceLabel = '<inline>'): TriggerDefinition {
  if (!isRecord(value)) {
    throw new TriggerError('TRIGGER_INVALID_DEFINITION', `Trigger definition ${sourceLabel} must be an object.`);
  }

  const triggerId = asTrimmedString(value.triggerId);
  const signalType = asTrimmedString(value.signalType);
  const mission = asTrimmedString(value.mission);
  const cooldownSlots = value.cooldownSlots;

  if (!triggerId) {
    throw new TriggerError('TRIGGER_INVALID_DEFINITION', `Trigger definition ${sourceLabel} triggerId must be a non-empty string.`);
  }
  if (!signalType) {
    throw new TriggerError('TRIGGER_INVALID_DEFINITION', `Trigger definition ${triggerId} signalType must be a non-empty string.`);
  }
  if (!mission) {
    throw new TriggerError('TRIGGER_INVALID_DEFINITION', `Trigger definition ${triggerId} mission must be a non-empty string.`);
  }
  if (!Number.isInteger(cooldownSlots) || cooldownSlots < 0) {
    throw new TriggerError('TRIGGER_INVALID_DEFINITION', `Trigger definition ${triggerId} cooldownSlots must be a non-negative integer.`);
  }

  return {
    triggerId,
    signalType,
    mission,
    cooldownSlots
  };
}

export function loadTriggerDefinitions(options: { definitionsDir?: string } = {}): TriggerDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_TRIGGER_DEFINITIONS_DIR);

  if (!fs.existsSync(definitionsDir)) {
    throw new TriggerError('TRIGGER_DEFINITIONS_NOT_FOUND', `Trigger definitions directory not found: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  const definitions = files.map((entry) => {
    const filePath = path.join(definitionsDir, entry);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return validateTriggerDefinition(parsed, entry);
  });

  return definitions.sort((left, right) => left.triggerId.localeCompare(right.triggerId));
}

export function getTriggersForSignal(signalType: string, options: { definitionsDir?: string } = {}): TriggerDefinition[] {
  return loadTriggerDefinitions(options)
    .filter((entry) => entry.signalType === signalType)
    .sort((left, right) => left.triggerId.localeCompare(right.triggerId));
}

export function createTriggerRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadTriggerDefinitions({ definitionsDir: options.definitionsDir });
  const byTriggerId = new Map<string, TriggerDefinition>();

  for (const definition of definitions) {
    if (byTriggerId.has(definition.triggerId)) {
      throw new TriggerError('TRIGGER_DUPLICATE_DEFINITION', `Duplicate triggerId detected: ${definition.triggerId}`);
    }
    byTriggerId.set(definition.triggerId, definition);
  }

  function listTriggers(): TriggerDefinition[] {
    return Array.from(byTriggerId.values())
      .sort((left, right) => left.triggerId.localeCompare(right.triggerId));
  }

  function getTrigger(triggerId: string): TriggerDefinition {
    const found = byTriggerId.get(triggerId);
    if (!found) {
      throw new TriggerError('TRIGGER_NOT_FOUND', `Trigger definition not found: ${triggerId}`);
    }
    return found;
  }

  function getTriggersForSignal(signalType: string): TriggerDefinition[] {
    return listTriggers().filter((entry) => entry.signalType === signalType);
  }

  return {
    listTriggers,
    getTrigger,
    getTriggersForSignal
  };
}

export type TriggerRegistry = ReturnType<typeof createTriggerRegistry>;
