import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  isValidExecutionJournalEventType,
  normalizeEventPayload,
} from './execution-journal-event-types.ts';
import type {
  ExecutionJournalEvent,
  ExecutionJournalEventType,
} from './execution-journal-types.ts';

export const DEFAULT_EXECUTION_JOURNAL_ARTIFACTS_ROOT = path.join('artifacts', 'execution-journal');

interface ExecutionJournalHistory {
  executionJournalId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  events: ExecutionJournalEvent[];
}

function normalizeRelativeSegment(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}: ${value}`);
  }
  return normalized;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function compareEvents(left: ExecutionJournalEvent, right: ExecutionJournalEvent): number {
  const byIndex = left.eventIndex - right.eventIndex;
  if (byIndex !== 0) {
    return byIndex;
  }

  const byType = left.eventType.localeCompare(right.eventType);
  if (byType !== 0) {
    return byType;
  }

  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEvent(value: unknown): ExecutionJournalEvent {
  if (!isRecord(value)) {
    throw new Error('EXECUTION_JOURNAL_INVALID_EVENT');
  }

  const eventTypeRaw = asString(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);
  const executionJournalId = asString(value.executionJournalId);
  const executionAttemptId = asString(value.executionAttemptId);
  const eventIndex = asInteger(value.eventIndex);

  if (!eventTypeRaw || !isValidExecutionJournalEventType(eventTypeRaw)) {
    throw new Error('EXECUTION_JOURNAL_INVALID_EVENT_TYPE');
  }

  if (!eventDedupeKey || !executionJournalId || !executionAttemptId || eventIndex === null) {
    throw new Error('EXECUTION_JOURNAL_INVALID_EVENT');
  }

  if (!isRecord(value.eventPayload)) {
    throw new Error('EXECUTION_JOURNAL_INVALID_EVENT_PAYLOAD');
  }

  const reasonTokens = Array.isArray(value.reasonTokens)
    ? value.reasonTokens.filter((entry): entry is string => typeof entry === 'string').sort((left, right) => left.localeCompare(right))
    : [];

  const blockingReasons = Array.isArray(value.blockingReasons)
    ? value.blockingReasons.filter((entry): entry is string => typeof entry === 'string').sort((left, right) => left.localeCompare(right))
    : [];

  const limitations = Array.isArray(value.limitations)
    ? value.limitations.filter((entry): entry is string => typeof entry === 'string').sort((left, right) => left.localeCompare(right))
    : [];

  return {
    eventType: eventTypeRaw,
    eventDedupeKey,
    executionJournalId,
    executionAttemptId,
    eventIndex,
    eventPayload: normalizeEventPayload(value.eventPayload),
    reasonTokens: uniqueSorted(reasonTokens),
    blockingReasons: uniqueSorted(blockingReasons),
    limitations: uniqueSorted(limitations),
  };
}

function readHistoryFile(filePath: string, fallback: ExecutionJournalHistory): ExecutionJournalHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('EXECUTION_JOURNAL_INVALID_HISTORY');
  }

  const executionJournalId = asString(parsed.executionJournalId);
  const executionAttemptId = asString(parsed.executionAttemptId);
  const runtimeEnvelopeId = asString(parsed.runtimeEnvelopeId);
  const executionContractId = asString(parsed.executionContractId);
  const missionId = asString(parsed.missionId);

  if (!executionJournalId || !executionAttemptId || !runtimeEnvelopeId || !executionContractId || !missionId) {
    throw new Error('EXECUTION_JOURNAL_INVALID_HISTORY');
  }

  const events = Array.isArray(parsed.events)
    ? parsed.events.map((event) => parseEvent(event)).sort(compareEvents)
    : [];

  return {
    executionJournalId,
    executionAttemptId,
    runtimeEnvelopeId,
    executionContractId,
    missionId,
    events,
  };
}

function computeNextEventIndex(events: ExecutionJournalEvent[]): number {
  if (events.length === 0) {
    return 0;
  }

  return Math.max(...events.map((event) => event.eventIndex)) + 1;
}

export function resolveExecutionJournalArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_EXECUTION_JOURNAL_ARTIFACTS_ROOT);
}

export function resolveExecutionJournalArtifactDir(input: { executionJournalId: string; rootDir?: string }): string {
  const executionJournalId = normalizeRelativeSegment(input.executionJournalId, 'execution_journal_id');
  return path.join(resolveExecutionJournalArtifactsRoot(input.rootDir), executionJournalId);
}

export function ensureExecutionJournalArtifactDir(input: { executionJournalId: string; rootDir?: string }): string {
  const dirPath = resolveExecutionJournalArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveExecutionJournalArtifactPaths(input: { executionJournalId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
  eventsJsonPath: string;
} {
  const dirPath = resolveExecutionJournalArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'execution-journal-status.json'),
    reportJsonPath: path.join(dirPath, 'execution-journal-report.json'),
    reportMarkdownPath: path.join(dirPath, 'execution-journal-report.md'),
    historyJsonPath: path.join(dirPath, 'execution-journal-history.json'),
    eventsJsonPath: path.join(dirPath, 'execution-journal-events.json'),
  };
}

export function computeExecutionJournalEventDedupeKey(input: {
  executionAttemptId: string;
  eventType: ExecutionJournalEventType;
  eventPayload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    executionAttemptId: input.executionAttemptId,
    eventType: input.eventType,
    eventPayload: normalizeEventPayload(input.eventPayload),
  }));
}

export function createExecutionJournalHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: {
    executionJournalId: string;
    executionAttemptId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
  }): ExecutionJournalHistory {
    const paths = resolveExecutionJournalArtifactPaths({
      executionJournalId: input.executionJournalId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      executionJournalId: input.executionJournalId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      events: [],
    });
  }

  function loadByExecutionJournalId(input: { executionJournalId: string }): ExecutionJournalHistory | null {
    const paths = resolveExecutionJournalArtifactPaths({
      executionJournalId: input.executionJournalId,
      rootDir: options.artifactsRoot,
    });

    if (!fs.existsSync(paths.historyJsonPath)) {
      return null;
    }

    return readHistoryFile(paths.historyJsonPath, {
      executionJournalId: input.executionJournalId,
      executionAttemptId: '',
      runtimeEnvelopeId: '',
      executionContractId: '',
      missionId: '',
      events: [],
    });
  }

  function append(input: {
    executionJournalId: string;
    executionAttemptId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
    eventType: ExecutionJournalEventType;
    eventPayload: Record<string, unknown>;
    reasonTokens?: string[];
    blockingReasons?: string[];
    limitations?: string[];
  }): { history: ExecutionJournalHistory; appended: boolean; event: ExecutionJournalEvent } {
    ensureExecutionJournalArtifactDir({
      executionJournalId: input.executionJournalId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveExecutionJournalArtifactPaths({
      executionJournalId: input.executionJournalId,
      rootDir: options.artifactsRoot,
    });

    const current = load({
      executionJournalId: input.executionJournalId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
    });

    const eventPayload = normalizeEventPayload(input.eventPayload);

    const eventDedupeKey = computeExecutionJournalEventDedupeKey({
      executionAttemptId: input.executionAttemptId,
      eventType: input.eventType,
      eventPayload,
    });

    const event: ExecutionJournalEvent = {
      eventType: input.eventType,
      eventDedupeKey,
      executionJournalId: input.executionJournalId,
      executionAttemptId: input.executionAttemptId,
      eventIndex: computeNextEventIndex(current.events),
      eventPayload,
      reasonTokens: uniqueSorted(input.reasonTokens ?? []),
      blockingReasons: uniqueSorted(input.blockingReasons ?? []),
      limitations: uniqueSorted(input.limitations ?? []),
    };

    if (current.events.some((entry) => entry.eventDedupeKey === event.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        event,
      };
    }

    const next: ExecutionJournalHistory = {
      executionJournalId: input.executionJournalId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      events: [...current.events, event].sort(compareEvents),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      event,
    };
  }

  function write(history: ExecutionJournalHistory): string {
    ensureExecutionJournalArtifactDir({
      executionJournalId: history.executionJournalId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveExecutionJournalArtifactPaths({
      executionJournalId: history.executionJournalId,
      rootDir: options.artifactsRoot,
    });

    const normalized: ExecutionJournalHistory = {
      executionJournalId: history.executionJournalId,
      executionAttemptId: history.executionAttemptId,
      runtimeEnvelopeId: history.runtimeEnvelopeId,
      executionContractId: history.executionContractId,
      missionId: history.missionId,
      events: [...history.events].sort(compareEvents),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    load,
    loadByExecutionJournalId,
    append,
    write,
  };
}

export type ExecutionJournalHistoryStore = ReturnType<typeof createExecutionJournalHistoryStore>;
