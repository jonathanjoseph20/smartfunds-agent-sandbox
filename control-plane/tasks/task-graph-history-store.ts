import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { ImplementationTaskGraphHistoryEvent } from './task-graph-types.ts';

const EVENT_TYPE_ORDER: Record<ImplementationTaskGraphHistoryEvent['eventType'], number> = {
  implementation_task_graph_created: 0,
  implementation_task_graph_materialized: 1,
};

const DEFAULT_IMPLEMENTATION_TASK_GRAPH_HISTORY_FILE = path.join(
  'runtime-data',
  'tasks',
  'implementation-task-graph-history.json',
);

type ImplementationTaskGraphHistoryRecord = {
  entries: ImplementationTaskGraphHistoryEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEvent(value: unknown): ImplementationTaskGraphHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_HISTORY_EVENT');
  }

  const eventType = asString(value.eventType) as ImplementationTaskGraphHistoryEvent['eventType'];
  const taskGraphId = asString(value.taskGraphId);
  const payloadHash = asString(value.payloadHash);

  if (!eventType || !taskGraphId || !payloadHash) {
    throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_HISTORY_EVENT');
  }

  return {
    eventType,
    taskGraphId,
    payloadHash,
  };
}

function computeEventHash(event: ImplementationTaskGraphHistoryEvent): string {
  return sha256(canonicalStringify({
    eventType: event.eventType,
    taskGraphId: event.taskGraphId,
    payloadHash: event.payloadHash,
  }));
}

function compareEvents(left: ImplementationTaskGraphHistoryEvent, right: ImplementationTaskGraphHistoryEvent): number {
  const graphCmp = left.taskGraphId.localeCompare(right.taskGraphId);
  if (graphCmp !== 0) {
    return graphCmp;
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

function readHistory(filePath: string): ImplementationTaskGraphHistoryRecord {
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('IMPLEMENTATION_TASK_GRAPH_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEvent(entry)).sort(compareEvents)
    : [];

  return { entries };
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function createImplementationTaskGraphHistoryStore(options: {
  historyFilePath?: string;
} = {}) {
  const historyFilePath = options.historyFilePath ?? DEFAULT_IMPLEMENTATION_TASK_GRAPH_HISTORY_FILE;

  function appendImplementationTaskGraphEvent(event: ImplementationTaskGraphHistoryEvent): {
    appended: boolean;
    event: ImplementationTaskGraphHistoryEvent;
    entries: ImplementationTaskGraphHistoryEvent[];
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

  function listImplementationTaskGraphEvents(taskGraphId: string): ImplementationTaskGraphHistoryEvent[] {
    return readHistory(historyFilePath).entries
      .filter((entry) => entry.taskGraphId === taskGraphId)
      .sort(compareEvents);
  }

  function listAllImplementationTaskGraphEvents(): ImplementationTaskGraphHistoryEvent[] {
    return readHistory(historyFilePath).entries;
  }

  return {
    appendImplementationTaskGraphEvent,
    listImplementationTaskGraphEvents,
    listAllImplementationTaskGraphEvents,
  };
}

export type ImplementationTaskGraphHistoryStore = ReturnType<typeof createImplementationTaskGraphHistoryStore>;
