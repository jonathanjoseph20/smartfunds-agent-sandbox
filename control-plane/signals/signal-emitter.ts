import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import { computeSignalDedupeKey, createSignalDeduper, type SignalDeduper } from './signal-deduper.ts';
import { createSignalRegistry, type SignalRegistry } from './signal-registry.ts';
import { createSignalStore, type SignalStore } from './signal-store.ts';
import type { EmitSignalResult, SignalRecord } from './signal-types.ts';
import { SignalError } from './signal-types.ts';

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

function deriveLogDate(input: { slot: string; payload: Record<string, unknown> }): string {
  const reportDate = asTrimmedString(input.payload.reportDate);
  if (reportDate && /^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    return reportDate;
  }

  const dailyMatch = input.slot.match(/^daily:(\d{4}-\d{2}-\d{2})$/);
  if (dailyMatch?.[1]) {
    return dailyMatch[1];
  }

  const genericMatch = input.slot.match(/(\d{4}-\d{2}-\d{2})/);
  if (genericMatch?.[1]) {
    return genericMatch[1];
  }

  throw new SignalError(
    'SIGNAL_MISSING_DETERMINISTIC_DATE',
    'Signal requires deterministic reportDate or slot with YYYY-MM-DD.'
  );
}

function normalizedMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(payload)
    .filter(([key]) => key !== 'dataset' && key !== 'slot' && key !== 'artifactReference' && key !== 'reportDate')
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.parse(canonicalStringify(Object.fromEntries(entries))) as Record<string, unknown>;
}

function buildSignalRecord(input: {
  signalType: string;
  sourceMission: string;
  payload: Record<string, unknown>;
}): SignalRecord {
  const dataset = asTrimmedString(input.payload.dataset);
  const slot = asTrimmedString(input.payload.slot);
  if (!dataset) {
    throw new SignalError('SIGNAL_INVALID_PAYLOAD', `Signal payload for ${input.signalType} requires dataset string.`);
  }
  if (!slot) {
    throw new SignalError('SIGNAL_INVALID_PAYLOAD', `Signal payload for ${input.signalType} requires slot string.`);
  }

  const artifactReference = asTrimmedString(input.payload.artifactReference) ?? undefined;
  const logDate = deriveLogDate({ slot, payload: input.payload });
  const dedupeKey = computeSignalDedupeKey({
    signalType: input.signalType,
    dataset,
    slot
  });

  return {
    signalType: input.signalType,
    sourceMission: input.sourceMission,
    dataset,
    ...(artifactReference ? { artifactReference } : {}),
    metadata: normalizedMetadata(input.payload),
    slot,
    dedupeKey,
    logDate
  };
}

export function createSignalEmitter(options: {
  definitionsDir?: string;
  signalsRootDir?: string;
  registry?: SignalRegistry;
  store?: SignalStore;
  deduper?: SignalDeduper;
} = {}) {
  const registry = options.registry ?? createSignalRegistry({ definitionsDir: options.definitionsDir });
  const store = options.store ?? createSignalStore({ rootDir: options.signalsRootDir });
  const deduper = options.deduper ?? createSignalDeduper(store);

  function emitSignal(signalType: string, payload: unknown): EmitSignalResult {
    if (!isRecord(payload)) {
      throw new SignalError('SIGNAL_INVALID_PAYLOAD', `Signal payload for ${signalType} must be an object.`);
    }

    const definition = registry.getSignalDefinition(signalType);
    const validatedPayload = registry.validateSignalPayload(signalType, payload);

    const record = buildSignalRecord({
      signalType,
      sourceMission: definition.sourceMission,
      payload: validatedPayload
    });

    if (deduper.isDuplicate(record)) {
      return {
        status: 'duplicate',
        signal: record
      };
    }

    const persisted = store.appendSignal(record);
    if (!persisted.appended) {
      return {
        status: 'duplicate',
        signal: record
      };
    }

    return {
      status: 'persisted',
      signal: record,
      path: persisted.path
    };
  }

  return {
    emitSignal,
    getSignalDefinition: registry.getSignalDefinition,
    listSignalTypes: registry.listSignalTypes,
    listSignals: store.listSignals,
    listHistory: store.listHistory,
    signalsRootDir: path.resolve(options.signalsRootDir ?? 'signals')
  };
}

export type SignalEmitter = ReturnType<typeof createSignalEmitter>;
