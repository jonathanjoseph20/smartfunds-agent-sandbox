import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  RepoScaffoldHistoryEvent,
  RepoScaffoldHistoryEventType,
} from './repo-scaffold-types.ts';

const EVENT_TYPE_ORDER: Record<RepoScaffoldHistoryEventType, number> = {
  repo_scaffold_created: 0,
  repo_scaffold_updated: 1,
  repo_scaffold_validated: 2,
  repo_scaffold_materialized: 3,
  repo_scaffold_status_changed: 4,
};

const DEFAULT_REPO_SCAFFOLD_HISTORY_FILE = path.join(
  'runtime-data',
  'repo-scaffold',
  'repo-scaffold-history.json',
);

type RepoScaffoldHistoryRecord = {
  entries: RepoScaffoldHistoryEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEvent(value: unknown): RepoScaffoldHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('REPO_SCAFFOLD_INVALID_HISTORY_EVENT');
  }

  const eventType = asString(value.eventType) as RepoScaffoldHistoryEventType;
  const bundleId = asString(value.bundleId);
  const payloadHash = asString(value.payloadHash);

  if (!eventType || !bundleId || !payloadHash || !isRecord(value.payload)) {
    throw new Error('REPO_SCAFFOLD_INVALID_HISTORY_EVENT');
  }

  return {
    bundleId,
    eventType,
    payloadHash,
    payload: JSON.parse(canonicalStringify(value.payload)) as Record<string, unknown>,
  };
}

function computeEventHash(event: RepoScaffoldHistoryEvent): string {
  return sha256(canonicalStringify({
    eventType: event.eventType,
    bundleId: event.bundleId,
    payloadHash: event.payloadHash,
  }));
}

function compareEvents(left: RepoScaffoldHistoryEvent, right: RepoScaffoldHistoryEvent): number {
  const bundleCmp = left.bundleId.localeCompare(right.bundleId);
  if (bundleCmp !== 0) {
    return bundleCmp;
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

function readHistory(filePath: string): RepoScaffoldHistoryRecord {
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('REPO_SCAFFOLD_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEvent(entry)).sort(compareEvents)
    : [];

  return { entries };
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function createRepoScaffoldHistoryStore(options: {
  historyFilePath?: string;
} = {}) {
  const historyFilePath = options.historyFilePath ?? DEFAULT_REPO_SCAFFOLD_HISTORY_FILE;

  function appendRepoScaffoldEvent(event: RepoScaffoldHistoryEvent): {
    appended: boolean;
    event: RepoScaffoldHistoryEvent;
    entries: RepoScaffoldHistoryEvent[];
  } {
    ensureParentDir(historyFilePath);

    const normalizedEvent: RepoScaffoldHistoryEvent = {
      bundleId: event.bundleId,
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

  function listRepoScaffoldEvents(bundleId: string): RepoScaffoldHistoryEvent[] {
    return readHistory(historyFilePath)
      .entries
      .filter((entry) => entry.bundleId === bundleId)
      .sort(compareEvents);
  }

  function listAllRepoScaffoldEvents(): RepoScaffoldHistoryEvent[] {
    return readHistory(historyFilePath).entries;
  }

  return {
    appendRepoScaffoldEvent,
    listRepoScaffoldEvents,
    listAllRepoScaffoldEvents,
  };
}

export type RepoScaffoldHistoryStore = ReturnType<typeof createRepoScaffoldHistoryStore>;
