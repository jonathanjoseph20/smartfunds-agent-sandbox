import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import { deriveTaskExecutionEventDedupeKey } from './task-execution-step-identity.ts';
import {
  TASK_EXECUTION_STEP_TYPES,
  type MissionTaskExecutionHistory,
  type MissionTaskExecutionHistoryEntry,
  type TaskExecutionStepType,
} from './task-execution-step-types.ts';

export const DEFAULT_TASK_EXECUTION_ARTIFACTS_ROOT = path.join('artifacts', 'task-execution');

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

function compareEntries(left: MissionTaskExecutionHistoryEntry, right: MissionTaskExecutionHistoryEntry): number {
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

function parseEntry(value: unknown): MissionTaskExecutionHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('TASK_EXECUTION_HISTORY_CONFLICT');
  }

  const executionEngineRunId = asString(value.executionEngineRunId);
  const executionAttemptId = asString(value.executionAttemptId);
  const taskGraphId = asString(value.taskGraphId);
  const eventIndex = asInteger(value.eventIndex);
  const eventType = asString(value.eventType) as TaskExecutionStepType | null;
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (
    !executionEngineRunId
    || !executionAttemptId
    || !taskGraphId
    || eventIndex === null
    || !eventType
    || !TASK_EXECUTION_STEP_TYPES.includes(eventType)
    || !eventDedupeKey
    || !isRecord(value.eventPayload)
  ) {
    throw new Error('TASK_EXECUTION_HISTORY_CONFLICT');
  }

  return {
    executionEngineRunId,
    executionAttemptId,
    taskGraphId,
    eventIndex,
    eventType,
    eventDedupeKey,
    eventPayload: normalizePayload(value.eventPayload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionTaskExecutionHistory): MissionTaskExecutionHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('TASK_EXECUTION_HISTORY_CONFLICT');
  }

  const executionEngineRunId = asString(parsed.executionEngineRunId);
  const executionAttemptId = asString(parsed.executionAttemptId);
  const taskGraphId = asString(parsed.taskGraphId);

  if (!executionEngineRunId || !executionAttemptId || !taskGraphId) {
    throw new Error('TASK_EXECUTION_HISTORY_CONFLICT');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    executionEngineRunId,
    executionAttemptId,
    taskGraphId,
    entries,
  };
}

function computeNextEventIndex(entries: MissionTaskExecutionHistoryEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }

  return Math.max(...entries.map((entry) => entry.eventIndex)) + 1;
}

export function resolveTaskExecutionArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_TASK_EXECUTION_ARTIFACTS_ROOT);
}

export function resolveTaskExecutionArtifactDir(input: { executionEngineRunId: string; rootDir?: string }): string {
  const executionEngineRunId = normalizeRelativeSegment(input.executionEngineRunId, 'execution_engine_run_id');
  return path.join(resolveTaskExecutionArtifactsRoot(input.rootDir), executionEngineRunId);
}

export function ensureTaskExecutionArtifactDir(input: { executionEngineRunId: string; rootDir?: string }): string {
  const dirPath = resolveTaskExecutionArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveTaskExecutionArtifactPaths(input: {
  executionEngineRunId: string;
  rootDir?: string;
}): {
  dirPath: string;
  statusJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
  stepsJsonPath: string;
  progressJsonPath: string;
  failuresJsonPath: string;
  retriesJsonPath: string;
  blockersJsonPath: string;
  concurrencyJsonPath: string;
  runnableSetJsonPath: string;
  schedulingWavesJsonPath: string;
} {
  const dirPath = resolveTaskExecutionArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'task-execution-status.json'),
    reportJsonPath: path.join(dirPath, 'task-execution-report.json'),
    reportMarkdownPath: path.join(dirPath, 'task-execution-report.md'),
    historyJsonPath: path.join(dirPath, 'task-execution-history.json'),
    stepsJsonPath: path.join(dirPath, 'task-execution-steps.json'),
    progressJsonPath: path.join(dirPath, 'task-execution-progress.json'),
    failuresJsonPath: path.join(dirPath, 'task-execution-failures.json'),
    retriesJsonPath: path.join(dirPath, 'task-execution-retries.json'),
    blockersJsonPath: path.join(dirPath, 'task-execution-blockers.json'),
    concurrencyJsonPath: path.join(dirPath, 'task-execution-concurrency.json'),
    runnableSetJsonPath: path.join(dirPath, 'task-execution-runnable-set.json'),
    schedulingWavesJsonPath: path.join(dirPath, 'task-execution-scheduling-waves.json'),
  };
}

export function createTaskExecutionHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: {
    executionEngineRunId: string;
    executionAttemptId: string;
    taskGraphId: string;
  }): MissionTaskExecutionHistory {
    const paths = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: input.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      taskGraphId: input.taskGraphId,
      entries: [],
    });
  }

  function loadByExecutionEngineRunId(input: { executionEngineRunId: string }): MissionTaskExecutionHistory | null {
    const paths = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: input.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    if (!fs.existsSync(paths.historyJsonPath)) {
      return null;
    }

    return readHistoryFile(paths.historyJsonPath, {
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: '',
      taskGraphId: '',
      entries: [],
    });
  }

  function append(input: {
    executionEngineRunId: string;
    executionAttemptId: string;
    taskGraphId: string;
    eventType: TaskExecutionStepType;
    eventPayload: Record<string, unknown>;
  }): {
    history: MissionTaskExecutionHistory;
    appended: boolean;
    entry: MissionTaskExecutionHistoryEntry;
  } {
    ensureTaskExecutionArtifactDir({
      executionEngineRunId: input.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: input.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    const current = load({
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      taskGraphId: input.taskGraphId,
    });

    const eventPayload = normalizePayload(input.eventPayload);
    const eventDedupeKey = deriveTaskExecutionEventDedupeKey({
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      taskGraphId: input.taskGraphId,
      eventType: input.eventType,
      eventPayload,
    });

    const entry: MissionTaskExecutionHistoryEntry = {
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      taskGraphId: input.taskGraphId,
      eventIndex: computeNextEventIndex(current.entries),
      eventType: input.eventType,
      eventPayload,
      eventDedupeKey,
    };

    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionTaskExecutionHistory = {
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      taskGraphId: input.taskGraphId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function write(history: MissionTaskExecutionHistory): string {
    ensureTaskExecutionArtifactDir({
      executionEngineRunId: history.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: history.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionTaskExecutionHistory = {
      executionEngineRunId: history.executionEngineRunId,
      executionAttemptId: history.executionAttemptId,
      taskGraphId: history.taskGraphId,
      entries: [...history.entries].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    load,
    loadByExecutionEngineRunId,
    append,
    write,
  };
}

export type TaskExecutionHistoryStore = ReturnType<typeof createTaskExecutionHistoryStore>;
