import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  ProductFactoryReleaseHistoryEvent,
  ProductFactoryReleaseHistoryEventType,
} from './product-factory-release-acceptance-types.ts';

const DEFAULT_PRODUCT_FACTORY_RELEASE_HISTORY_FILE = path.join(
  'runtime-data',
  'product-factory-release',
  'product-factory-release-history.json',
);

const EVENT_TYPE_ORDER: Record<ProductFactoryReleaseHistoryEventType, number> = {
  product_factory_release_acceptance_record_created: 0,
  product_factory_lifecycle_acceptance_recorded: 1,
  product_factory_replay_validation_recorded: 2,
  product_factory_docs_completeness_recorded: 3,
  product_factory_release_hardening_recorded: 4,
  product_factory_release_materialized: 5,
  product_factory_release_failed: 6,
  product_factory_release_closed: 7,
};

type ProductFactoryReleaseHistoryStoreFile = {
  entries: ProductFactoryReleaseHistoryEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEvent(value: unknown): ProductFactoryReleaseHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('PRODUCT_FACTORY_RELEASE_INVALID_HISTORY_EVENT');
  }

  const productFactoryReleaseAcceptanceRecordId = asString(value.productFactoryReleaseAcceptanceRecordId);
  const releaseTrack = asString(value.releaseTrack);
  const eventType = asString(value.eventType) as ProductFactoryReleaseHistoryEventType;
  const payloadHash = asString(value.payloadHash);

  if (!productFactoryReleaseAcceptanceRecordId || !releaseTrack || !eventType || !payloadHash || !isRecord(value.payload)) {
    throw new Error('PRODUCT_FACTORY_RELEASE_INVALID_HISTORY_EVENT');
  }

  return {
    productFactoryReleaseAcceptanceRecordId,
    releaseTrack,
    eventType,
    payloadHash,
    payload: JSON.parse(canonicalStringify(value.payload)) as Record<string, unknown>,
  };
}

function computeEventHash(event: ProductFactoryReleaseHistoryEvent): string {
  return sha256(canonicalStringify({
    productFactoryReleaseAcceptanceRecordId: event.productFactoryReleaseAcceptanceRecordId,
    releaseTrack: event.releaseTrack,
    eventType: event.eventType,
    payloadHash: event.payloadHash,
  }));
}

function compareEvents(left: ProductFactoryReleaseHistoryEvent, right: ProductFactoryReleaseHistoryEvent): number {
  const byRecord = left.productFactoryReleaseAcceptanceRecordId.localeCompare(right.productFactoryReleaseAcceptanceRecordId);
  if (byRecord !== 0) {
    return byRecord;
  }

  const byEventType = EVENT_TYPE_ORDER[left.eventType] - EVENT_TYPE_ORDER[right.eventType];
  if (byEventType !== 0) {
    return byEventType;
  }

  const byPayloadHash = left.payloadHash.localeCompare(right.payloadHash);
  if (byPayloadHash !== 0) {
    return byPayloadHash;
  }

  return computeEventHash(left).localeCompare(computeEventHash(right));
}

function readHistory(filePath: string): ProductFactoryReleaseHistoryStoreFile {
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('PRODUCT_FACTORY_RELEASE_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEvent(entry)).sort(compareEvents)
    : [];

  return { entries };
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function toProductFactoryReleasePayloadHash(payload: unknown): string {
  return sha256(canonicalStringify(payload));
}

export function createProductFactoryReleaseHistoryStore(options: {
  historyFilePath?: string;
} = {}) {
  const historyFilePath = options.historyFilePath ?? DEFAULT_PRODUCT_FACTORY_RELEASE_HISTORY_FILE;

  function appendProductFactoryReleaseEvent(event: ProductFactoryReleaseHistoryEvent): {
    appended: boolean;
    event: ProductFactoryReleaseHistoryEvent;
    entries: ProductFactoryReleaseHistoryEvent[];
  } {
    ensureParentDir(historyFilePath);

    const normalizedEvent: ProductFactoryReleaseHistoryEvent = {
      productFactoryReleaseAcceptanceRecordId: event.productFactoryReleaseAcceptanceRecordId,
      releaseTrack: event.releaseTrack,
      eventType: event.eventType,
      payloadHash: event.payloadHash,
      payload: JSON.parse(canonicalStringify(event.payload)) as Record<string, unknown>,
    };

    const current = readHistory(historyFilePath);
    const nextHash = computeEventHash(normalizedEvent);

    if (current.entries.some((entry) => computeEventHash(entry) === nextHash)) {
      return {
        appended: false,
        event: normalizedEvent,
        entries: current.entries,
      };
    }

    const entries = [...current.entries, normalizedEvent].sort(compareEvents);
    fs.writeFileSync(historyFilePath, `${canonicalStringify({ entries })}\n`, 'utf8');

    return {
      appended: true,
      event: normalizedEvent,
      entries,
    };
  }

  function listProductFactoryReleaseEvents(
    productFactoryReleaseAcceptanceRecordId: string,
  ): ProductFactoryReleaseHistoryEvent[] {
    return readHistory(historyFilePath).entries
      .filter((entry) => entry.productFactoryReleaseAcceptanceRecordId === productFactoryReleaseAcceptanceRecordId)
      .sort(compareEvents);
  }

  function listAllProductFactoryReleaseEvents(): ProductFactoryReleaseHistoryEvent[] {
    return readHistory(historyFilePath).entries;
  }

  return {
    appendProductFactoryReleaseEvent,
    listProductFactoryReleaseEvents,
    listAllProductFactoryReleaseEvents,
  };
}

export type ProductFactoryReleaseHistoryStore = ReturnType<typeof createProductFactoryReleaseHistoryStore>;
