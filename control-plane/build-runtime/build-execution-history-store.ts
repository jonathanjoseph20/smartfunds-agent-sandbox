import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  BuildExecutionHistoryEvent,
  BuildExecutionHistoryEventType,
} from './build-execution-types.ts';

const EVENT_TYPE_ORDER: Record<BuildExecutionHistoryEventType, number> = {
  build_execution_created: 0,
  build_execution_started: 1,
  build_execution_step_completed: 2,
  build_execution_completed: 3,
  build_execution_failed: 4,
  build_execution_artifacts_materialized: 5,
};

const DEFAULT_BUILD_EXECUTION_HISTORY_FILE = path.join(
  'runtime-data',
  'build-runtime',
  'build-execution-history.json',
);

type BuildExecutionHistoryRecord = {
  entries: BuildExecutionHistoryEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEvent(value: unknown): BuildExecutionHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('BUILD_EXECUTION_INVALID_HISTORY_EVENT');
  }

  const eventType = asString(value.eventType) as BuildExecutionHistoryEventType;
  const runId = asString(value.runId);
  const payloadHash = asString(value.payloadHash);

  if (!eventType || !runId || !payloadHash || !isRecord(value.payload)) {
    throw new Error('BUILD_EXECUTION_INVALID_HISTORY_EVENT');
  }

  return {
    runId,
    eventType,
    payloadHash,
    payload: JSON.parse(canonicalStringify(value.payload)) as Record<string, unknown>,
  };
}

function computeEventHash(event: BuildExecutionHistoryEvent): string {
  return sha256(canonicalStringify({
    runId: event.runId,
    eventType: event.eventType,
    payloadHash: event.payloadHash,
  }));
}

function compareEvents(left: BuildExecutionHistoryEvent, right: BuildExecutionHistoryEvent): number {
  const runCmp = left.runId.localeCompare(right.runId);
  if (runCmp !== 0) {
    return runCmp;
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

function readHistory(filePath: string): BuildExecutionHistoryRecord {
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('BUILD_EXECUTION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEvent(entry)).sort(compareEvents)
    : [];

  return { entries };
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function createBuildExecutionHistoryStore(options: {
  historyFilePath?: string;
} = {}) {
  const historyFilePath = options.historyFilePath ?? DEFAULT_BUILD_EXECUTION_HISTORY_FILE;

  function appendBuildExecutionEvent(event: BuildExecutionHistoryEvent): {
    appended: boolean;
    event: BuildExecutionHistoryEvent;
    entries: BuildExecutionHistoryEvent[];
  } {
    ensureParentDir(historyFilePath);

    const normalizedEvent: BuildExecutionHistoryEvent = {
      runId: event.runId,
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

  function listBuildExecutionEvents(runId: string): BuildExecutionHistoryEvent[] {
    return readHistory(historyFilePath)
      .entries
      .filter((entry) => entry.runId === runId)
      .sort(compareEvents);
  }

  function listAllBuildExecutionEvents(): BuildExecutionHistoryEvent[] {
    return readHistory(historyFilePath).entries;
  }

  return {
    appendBuildExecutionEvent,
    listBuildExecutionEvents,
    listAllBuildExecutionEvents,
  };
}

export type BuildExecutionHistoryStore = ReturnType<typeof createBuildExecutionHistoryStore>;
