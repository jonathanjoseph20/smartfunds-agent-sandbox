import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import { computeCommerceHistoryEventHash } from './charge-intent-identity.ts';
import { cloneRecord } from './commerce-normalizer.ts';
import type { CommerceHistoryEvent, CommerceHistoryEventType } from './charge-intent-types.ts';

const DEFAULT_COMMERCE_HISTORY_FILE = path.join(
  'runtime-data',
  'commerce',
  'commerce-history.json',
);

const EVENT_TYPE_ORDER: Record<CommerceHistoryEventType, number> = {
  charge_intent_created: 0,
  rail_binding_recorded: 1,
  rail_eligibility_evaluated: 2,
  payment_receipt_recorded: 3,
  settlement_logged: 4,
  commerce_materialized: 5,
  commerce_failed: 6,
};

type CommerceHistoryFile = {
  entries: CommerceHistoryEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseHistoryEvent(value: unknown): CommerceHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('COMMERCE_INVALID_HISTORY_EVENT');
  }

  const chargeIntentId = asString(value.chargeIntentId);
  const eventType = asString(value.eventType) as CommerceHistoryEventType;
  const payloadHash = asString(value.payloadHash);

  if (!chargeIntentId || !eventType || !payloadHash || !isRecord(value.payload)) {
    throw new Error('COMMERCE_INVALID_HISTORY_EVENT');
  }

  return {
    chargeIntentId,
    eventType,
    payloadHash,
    payload: cloneRecord(value.payload),
  };
}

function compareHistoryEvents(left: CommerceHistoryEvent, right: CommerceHistoryEvent): number {
  const byIntent = left.chargeIntentId.localeCompare(right.chargeIntentId);
  if (byIntent !== 0) {
    return byIntent;
  }

  const byType = EVENT_TYPE_ORDER[left.eventType] - EVENT_TYPE_ORDER[right.eventType];
  if (byType !== 0) {
    return byType;
  }

  const byPayloadHash = left.payloadHash.localeCompare(right.payloadHash);
  if (byPayloadHash !== 0) {
    return byPayloadHash;
  }

  return computeCommerceHistoryEventHash(left).localeCompare(computeCommerceHistoryEventHash(right));
}

function readHistory(filePath: string): CommerceHistoryFile {
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('COMMERCE_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseHistoryEvent(entry)).sort(compareHistoryEvents)
    : [];

  return { entries };
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function toCommercePayloadHash(payload: unknown): string {
  return sha256(canonicalStringify(payload));
}

export function createCommerceHistoryStore(options: {
  historyFilePath?: string;
} = {}) {
  const historyFilePath = options.historyFilePath ?? DEFAULT_COMMERCE_HISTORY_FILE;

  function appendCommerceEvent(event: CommerceHistoryEvent): {
    appended: boolean;
    event: CommerceHistoryEvent;
    entries: CommerceHistoryEvent[];
  } {
    ensureParentDir(historyFilePath);

    const normalizedEvent: CommerceHistoryEvent = {
      chargeIntentId: event.chargeIntentId,
      eventType: event.eventType,
      payloadHash: event.payloadHash,
      payload: cloneRecord(event.payload),
    };

    const current = readHistory(historyFilePath);
    const nextHash = computeCommerceHistoryEventHash(normalizedEvent);

    if (current.entries.some((entry) => computeCommerceHistoryEventHash(entry) === nextHash)) {
      return {
        appended: false,
        event: normalizedEvent,
        entries: current.entries,
      };
    }

    const entries = [...current.entries, normalizedEvent].sort(compareHistoryEvents);
    fs.writeFileSync(historyFilePath, `${canonicalStringify({ entries })}\n`, 'utf8');

    return {
      appended: true,
      event: normalizedEvent,
      entries,
    };
  }

  function listCommerceEvents(chargeIntentId: string): CommerceHistoryEvent[] {
    return readHistory(historyFilePath).entries
      .filter((entry) => entry.chargeIntentId === chargeIntentId)
      .sort(compareHistoryEvents);
  }

  function listAllCommerceEvents(): CommerceHistoryEvent[] {
    return readHistory(historyFilePath).entries;
  }

  return {
    appendCommerceEvent,
    listCommerceEvents,
    listAllCommerceEvents,
  };
}

export type CommerceHistoryStore = ReturnType<typeof createCommerceHistoryStore>;
