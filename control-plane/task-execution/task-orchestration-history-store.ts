import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import { deriveTaskOrchestrationEventDedupeKey } from './task-orchestration-identity.ts';
import {
  TASK_ORCHESTRATION_EVENT_TYPES,
  type TaskOrchestrationEventType,
  type TaskOrchestrationHistory,
  type TaskOrchestrationHistoryEntry,
} from './task-orchestration-types.ts';

export const DEFAULT_TASK_ORCHESTRATION_ARTIFACTS_ROOT = path.join('artifacts', 'task-execution');

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

function asInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function normalizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

function compareEntries(left: TaskOrchestrationHistoryEntry, right: TaskOrchestrationHistoryEntry): number {
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

function parseEntry(value: unknown): TaskOrchestrationHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('TASK_ORCHESTRATION_HISTORY_CONFLICT');
  }

  const executionRunId = asString(value.executionRunId);
  const taskGraphId = asString(value.taskGraphId);
  const eventIndex = asInteger(value.eventIndex);
  const eventType = asString(value.eventType) as TaskOrchestrationEventType | null;
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (
    !executionRunId
    || !taskGraphId
    || eventIndex === null
    || !eventType
    || !TASK_ORCHESTRATION_EVENT_TYPES.includes(eventType)
    || !eventDedupeKey
    || !isRecord(value.eventPayload)
  ) {
    throw new Error('TASK_ORCHESTRATION_HISTORY_CONFLICT');
  }

  return {
    executionRunId,
    taskGraphId,
    eventIndex,
    eventType,
    eventDedupeKey,
    eventPayload: normalizePayload(value.eventPayload),
  };
}

function readHistoryFile(filePath: string, fallback: TaskOrchestrationHistory): TaskOrchestrationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('TASK_ORCHESTRATION_HISTORY_CONFLICT');
  }

  const executionRunId = asString(parsed.executionRunId);
  const taskGraphId = asString(parsed.taskGraphId);

  if (!executionRunId || !taskGraphId) {
    throw new Error('TASK_ORCHESTRATION_HISTORY_CONFLICT');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    executionRunId,
    taskGraphId,
    entries,
  };
}

function computeNextEventIndex(entries: TaskOrchestrationHistoryEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }

  return Math.max(...entries.map((entry) => entry.eventIndex)) + 1;
}

export function resolveTaskOrchestrationArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_TASK_ORCHESTRATION_ARTIFACTS_ROOT);
}

export function resolveTaskOrchestrationArtifactDir(input: { executionRunId: string; rootDir?: string }): string {
  const executionRunId = normalizeRelativeSegment(input.executionRunId, 'execution_run_id');
  return path.join(resolveTaskOrchestrationArtifactsRoot(input.rootDir), executionRunId);
}

export function ensureTaskOrchestrationArtifactDir(input: { executionRunId: string; rootDir?: string }): string {
  const dirPath = resolveTaskOrchestrationArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveTaskOrchestrationArtifactPaths(input: { executionRunId: string; rootDir?: string }) {
  const dirPath = resolveTaskOrchestrationArtifactDir(input);

  return {
    dirPath,
    historyJsonPath: path.join(dirPath, 'task-orchestration-history.json'),
    statusJsonPath: path.join(dirPath, 'task-orchestration-status.json'),
    reportJsonPath: path.join(dirPath, 'task-orchestration-report.json'),
    reportMarkdownPath: path.join(dirPath, 'task-orchestration-report.md'),
    assignmentsJsonPath: path.join(dirPath, 'task-worker-assignments.json'),
    queuesJsonPath: path.join(dirPath, 'task-worker-queues.json'),
    deferralsJsonPath: path.join(dirPath, 'task-worker-deferrals.json'),
  };
}

export function createTaskOrchestrationHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: { executionRunId: string; taskGraphId: string }): TaskOrchestrationHistory {
    const paths = resolveTaskOrchestrationArtifactPaths({
      executionRunId: input.executionRunId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      executionRunId: input.executionRunId,
      taskGraphId: input.taskGraphId,
      entries: [],
    });
  }

  function loadByExecutionRunId(input: { executionRunId: string }): TaskOrchestrationHistory | null {
    const paths = resolveTaskOrchestrationArtifactPaths({
      executionRunId: input.executionRunId,
      rootDir: options.artifactsRoot,
    });

    if (!fs.existsSync(paths.historyJsonPath)) {
      return null;
    }

    return readHistoryFile(paths.historyJsonPath, {
      executionRunId: input.executionRunId,
      taskGraphId: '',
      entries: [],
    });
  }

  function append(input: {
    executionRunId: string;
    taskGraphId: string;
    eventType: TaskOrchestrationEventType;
    eventPayload: Record<string, unknown>;
  }): {
    history: TaskOrchestrationHistory;
    appended: boolean;
    entry: TaskOrchestrationHistoryEntry;
  } {
    ensureTaskOrchestrationArtifactDir({
      executionRunId: input.executionRunId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveTaskOrchestrationArtifactPaths({
      executionRunId: input.executionRunId,
      rootDir: options.artifactsRoot,
    });

    const current = load({
      executionRunId: input.executionRunId,
      taskGraphId: input.taskGraphId,
    });

    const normalizedPayload = normalizePayload(input.eventPayload);
    const eventDedupeKey = deriveTaskOrchestrationEventDedupeKey({
      executionRunId: input.executionRunId,
      taskGraphId: input.taskGraphId,
      eventType: input.eventType,
      eventPayload: normalizedPayload,
    });

    const existing = current.entries.find((entry) => entry.eventDedupeKey === eventDedupeKey);
    if (existing) {
      return {
        history: current,
        appended: false,
        entry: existing,
      };
    }

    const entry: TaskOrchestrationHistoryEntry = {
      executionRunId: input.executionRunId,
      taskGraphId: input.taskGraphId,
      eventIndex: computeNextEventIndex(current.entries),
      eventType: input.eventType,
      eventPayload: normalizedPayload,
      eventDedupeKey,
    };

    const history: TaskOrchestrationHistory = {
      executionRunId: input.executionRunId,
      taskGraphId: input.taskGraphId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');

    return {
      history,
      appended: true,
      entry,
    };
  }

  return {
    load,
    loadByExecutionRunId,
    append,
  };
}

export type TaskOrchestrationHistoryStore = ReturnType<typeof createTaskOrchestrationHistoryStore>;
