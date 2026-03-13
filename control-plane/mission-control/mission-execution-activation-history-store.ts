import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  deriveExecutionActivationHistoryEventDedupeKey,
  normalizeCanonicalRecord,
  uniqueSortedStrings,
} from './mission-execution-activation-identity.ts';
import {
  EXECUTION_ACTIVATION_HISTORY_EVENT_TYPES,
  type ExecutionActivationHistory,
  type ExecutionActivationHistoryEvent,
  type ExecutionActivationHistoryEventType,
} from './mission-execution-activation-types.ts';
import { resolveMissionControlArtifactsRoot } from './mission-run-history-store.ts';

function normalizeRelativeSegment(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}: ${value}`);
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEventType(value: unknown): ExecutionActivationHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return EXECUTION_ACTIVATION_HISTORY_EVENT_TYPES.includes(parsed as ExecutionActivationHistoryEventType)
    ? (parsed as ExecutionActivationHistoryEventType)
    : null;
}

function parseEntry(value: unknown): ExecutionActivationHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('MISSION_EXECUTION_ACTIVATION_INVALID_HISTORY_ENTRY');
  }

  const executionActivationRecordId = asString(value.executionActivationRecordId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!executionActivationRecordId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('MISSION_EXECUTION_ACTIVATION_INVALID_HISTORY_ENTRY');
  }

  return {
    executionActivationRecordId,
    eventType,
    eventDedupeKey,
    reasonTokens: uniqueSortedStrings(
      Array.isArray(value.reasonTokens)
        ? value.reasonTokens.filter((entry): entry is string => typeof entry === 'string')
        : []
    ),
    payload: normalizeCanonicalRecord(value.payload),
  };
}

function compareEntries(left: ExecutionActivationHistoryEvent, right: ExecutionActivationHistoryEvent): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function readHistoryFile(filePath: string, fallback: ExecutionActivationHistory): ExecutionActivationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_EXECUTION_ACTIVATION_INVALID_HISTORY');
  }

  const executionActivationRecordId = asString(parsed.executionActivationRecordId);
  if (!executionActivationRecordId) {
    throw new Error('MISSION_EXECUTION_ACTIVATION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    executionActivationRecordId,
    entries,
  };
}

export function resolveMissionExecutionActivationArtifactDir(input: {
  executionActivationRecordId: string;
  rootDir?: string;
}): string {
  const executionActivationRecordId = normalizeRelativeSegment(
    input.executionActivationRecordId,
    'execution_activation_record_id'
  );
  return path.join(path.resolve(input.rootDir ?? resolveMissionControlArtifactsRoot()), 'activation', executionActivationRecordId);
}

export function ensureMissionExecutionActivationArtifactDir(input: {
  executionActivationRecordId: string;
  rootDir?: string;
}): string {
  const dirPath = resolveMissionExecutionActivationArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionExecutionActivationArtifactPaths(input: {
  executionActivationRecordId: string;
  rootDir?: string;
}): {
  dirPath: string;
  statusJsonPath: string;
  mappingJsonPath: string;
  eligibilityJsonPath: string;
  queueJsonPath: string;
  feedbackLinksJsonPath: string;
  historyJsonPath: string;
  outcomeJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveMissionExecutionActivationArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'mission-execution-activation-status.json'),
    mappingJsonPath: path.join(dirPath, 'mission-execution-activation-mapping.json'),
    eligibilityJsonPath: path.join(dirPath, 'mission-execution-activation-eligibility.json'),
    queueJsonPath: path.join(dirPath, 'mission-execution-activation-queue.json'),
    feedbackLinksJsonPath: path.join(dirPath, 'mission-execution-activation-feedback-links.json'),
    historyJsonPath: path.join(dirPath, 'mission-execution-activation-history.json'),
    outcomeJsonPath: path.join(dirPath, 'mission-execution-activation-outcome.json'),
    reportJsonPath: path.join(dirPath, 'mission-execution-activation-report.json'),
    reportMarkdownPath: path.join(dirPath, 'mission-execution-activation-report.md'),
  };
}

export function createMissionExecutionActivationHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? resolveMissionControlArtifactsRoot());

  function load(input: { executionActivationRecordId: string }): ExecutionActivationHistory {
    const paths = resolveMissionExecutionActivationArtifactPaths({
      executionActivationRecordId: input.executionActivationRecordId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      executionActivationRecordId: input.executionActivationRecordId,
      entries: [],
    });
  }

  function appendEvent(input: {
    executionActivationRecordId: string;
    eventType: ExecutionActivationHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): { history: ExecutionActivationHistory; appended: boolean; entry: ExecutionActivationHistoryEvent } {
    ensureMissionExecutionActivationArtifactDir({
      executionActivationRecordId: input.executionActivationRecordId,
      rootDir: artifactsRoot,
    });

    const entry: ExecutionActivationHistoryEvent = {
      executionActivationRecordId: input.executionActivationRecordId,
      eventType: input.eventType,
      eventDedupeKey: deriveExecutionActivationHistoryEventDedupeKey(input),
      reasonTokens: uniqueSortedStrings(input.reasonTokens),
      payload: normalizeCanonicalRecord(input.payload),
    };

    const current = load({ executionActivationRecordId: input.executionActivationRecordId });
    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return { history: current, appended: false, entry };
    }

    const next: ExecutionActivationHistory = {
      executionActivationRecordId: input.executionActivationRecordId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    const paths = resolveMissionExecutionActivationArtifactPaths({
      executionActivationRecordId: input.executionActivationRecordId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return { history: next, appended: true, entry };
  }

  function replay(input: { executionActivationRecordId: string }): ExecutionActivationHistoryEvent[] {
    return [...load(input).entries].sort(compareEntries);
  }

  function write(history: ExecutionActivationHistory): string {
    ensureMissionExecutionActivationArtifactDir({
      executionActivationRecordId: history.executionActivationRecordId,
      rootDir: artifactsRoot,
    });

    const normalized: ExecutionActivationHistory = {
      executionActivationRecordId: history.executionActivationRecordId,
      entries: [...history.entries].sort(compareEntries),
    };

    const paths = resolveMissionExecutionActivationArtifactPaths({
      executionActivationRecordId: history.executionActivationRecordId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    appendEvent,
    load,
    replay,
    write,
  };
}

export type MissionExecutionActivationHistoryStore = ReturnType<typeof createMissionExecutionActivationHistoryStore>;
