import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  CodexExecutionPacketHistoryEvent,
  CodexExecutionPacketHistoryEventType,
} from './codex-execution-packet-types.ts';

const EVENT_TYPE_ORDER: Record<CodexExecutionPacketHistoryEventType, number> = {
  codex_execution_packet_created: 0,
  codex_execution_packet_updated: 1,
  codex_execution_packet_validated: 2,
  codex_execution_packet_materialized: 3,
  codex_execution_packet_status_changed: 4,
};

const DEFAULT_CODEX_EXECUTION_PACKET_HISTORY_FILE = path.join(
  'runtime-data',
  'codex',
  'codex-execution-packet-history.json',
);

type CodexExecutionPacketHistoryRecord = {
  entries: CodexExecutionPacketHistoryEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEvent(value: unknown): CodexExecutionPacketHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('CODEX_EXECUTION_PACKET_INVALID_HISTORY_EVENT');
  }

  const eventType = asString(value.eventType) as CodexExecutionPacketHistoryEventType;
  const packetId = asString(value.packetId);
  const payloadHash = asString(value.payloadHash);

  if (!eventType || !packetId || !payloadHash || !isRecord(value.payload)) {
    throw new Error('CODEX_EXECUTION_PACKET_INVALID_HISTORY_EVENT');
  }

  return {
    packetId,
    eventType,
    payloadHash,
    payload: JSON.parse(canonicalStringify(value.payload)) as Record<string, unknown>,
  };
}

function computeEventHash(event: CodexExecutionPacketHistoryEvent): string {
  return sha256(canonicalStringify({
    eventType: event.eventType,
    packetId: event.packetId,
    payloadHash: event.payloadHash,
  }));
}

function compareEvents(left: CodexExecutionPacketHistoryEvent, right: CodexExecutionPacketHistoryEvent): number {
  const packetCmp = left.packetId.localeCompare(right.packetId);
  if (packetCmp !== 0) {
    return packetCmp;
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

function readHistory(filePath: string): CodexExecutionPacketHistoryRecord {
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('CODEX_EXECUTION_PACKET_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEvent(entry)).sort(compareEvents)
    : [];

  return { entries };
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function createCodexExecutionPacketHistoryStore(options: {
  historyFilePath?: string;
} = {}) {
  const historyFilePath = options.historyFilePath ?? DEFAULT_CODEX_EXECUTION_PACKET_HISTORY_FILE;

  function appendCodexExecutionPacketEvent(event: CodexExecutionPacketHistoryEvent): {
    appended: boolean;
    event: CodexExecutionPacketHistoryEvent;
    entries: CodexExecutionPacketHistoryEvent[];
  } {
    ensureParentDir(historyFilePath);

    const normalizedEvent: CodexExecutionPacketHistoryEvent = {
      packetId: event.packetId,
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

  function listCodexExecutionPacketEvents(packetId: string): CodexExecutionPacketHistoryEvent[] {
    return readHistory(historyFilePath)
      .entries
      .filter((entry) => entry.packetId === packetId)
      .sort(compareEvents);
  }

  function listAllCodexExecutionPacketEvents(): CodexExecutionPacketHistoryEvent[] {
    return readHistory(historyFilePath).entries;
  }

  return {
    appendCodexExecutionPacketEvent,
    listCodexExecutionPacketEvents,
    listAllCodexExecutionPacketEvents,
  };
}

export type CodexExecutionPacketHistoryStore = ReturnType<typeof createCodexExecutionPacketHistoryStore>;
