import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { ProductSpecHistoryEvent } from './product-spec-types.ts';

const EVENT_TYPE_ORDER: Record<ProductSpecHistoryEvent['eventType'], number> = {
  product_spec_created: 0,
  product_spec_updated: 1,
  product_spec_validated: 2,
  product_spec_status_changed: 3,
};

const DEFAULT_PRODUCT_SPEC_HISTORY_FILE = path.join('runtime-data', 'products', 'product-spec-history.json');

type ProductSpecHistoryRecord = {
  entries: ProductSpecHistoryEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEvent(value: unknown): ProductSpecHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('PRODUCT_SPEC_INVALID_HISTORY_EVENT');
  }

  const eventType = asString(value.eventType) as ProductSpecHistoryEvent['eventType'];
  const specId = asString(value.specId);
  const payloadHash = asString(value.payloadHash);

  if (!eventType || !specId || !payloadHash) {
    throw new Error('PRODUCT_SPEC_INVALID_HISTORY_EVENT');
  }

  return {
    eventType,
    specId,
    payloadHash,
  };
}

function computeEventHash(event: ProductSpecHistoryEvent): string {
  return sha256(canonicalStringify({
    eventType: event.eventType,
    specId: event.specId,
    payloadHash: event.payloadHash,
  }));
}

function compareEvents(left: ProductSpecHistoryEvent, right: ProductSpecHistoryEvent): number {
  const specCmp = left.specId.localeCompare(right.specId);
  if (specCmp !== 0) {
    return specCmp;
  }

  const typeCmp = EVENT_TYPE_ORDER[left.eventType] - EVENT_TYPE_ORDER[right.eventType];
  if (typeCmp !== 0) {
    return typeCmp;
  }

  const payloadCmp = left.payloadHash.localeCompare(right.payloadHash);
  if (payloadCmp !== 0) {
    return payloadCmp;
  }

  return computeEventHash(left).localeCompare(computeEventHash(right));
}

function readHistory(filePath: string): ProductSpecHistoryRecord {
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('PRODUCT_SPEC_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEvent(entry)).sort(compareEvents)
    : [];

  return { entries };
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function createProductSpecHistoryStore(options: { historyFilePath?: string } = {}) {
  const historyFilePath = options.historyFilePath ?? DEFAULT_PRODUCT_SPEC_HISTORY_FILE;

  function appendProductSpecEvent(event: ProductSpecHistoryEvent): {
    appended: boolean;
    event: ProductSpecHistoryEvent;
    entries: ProductSpecHistoryEvent[];
  } {
    ensureParentDir(historyFilePath);

    const current = readHistory(historyFilePath);
    const nextHash = computeEventHash(event);

    if (current.entries.some((entry) => computeEventHash(entry) === nextHash)) {
      return {
        appended: false,
        event,
        entries: current.entries,
      };
    }

    const entries = [...current.entries, event].sort(compareEvents);
    fs.writeFileSync(historyFilePath, `${canonicalStringify({ entries })}\n`, 'utf8');

    return {
      appended: true,
      event,
      entries,
    };
  }

  function listProductSpecEvents(specId: string): ProductSpecHistoryEvent[] {
    return readHistory(historyFilePath)
      .entries
      .filter((entry) => entry.specId === specId)
      .sort(compareEvents);
  }

  function listAllProductSpecEvents(): ProductSpecHistoryEvent[] {
    return readHistory(historyFilePath).entries;
  }

  return {
    appendProductSpecEvent,
    listProductSpecEvents,
    listAllProductSpecEvents,
  };
}

const defaultStore = createProductSpecHistoryStore();

export function appendProductSpecEvent(event: ProductSpecHistoryEvent) {
  return defaultStore.appendProductSpecEvent(event);
}

export function listProductSpecEvents(specId: string): ProductSpecHistoryEvent[] {
  return defaultStore.listProductSpecEvents(specId);
}

export type ProductSpecHistoryStore = ReturnType<typeof createProductSpecHistoryStore>;
