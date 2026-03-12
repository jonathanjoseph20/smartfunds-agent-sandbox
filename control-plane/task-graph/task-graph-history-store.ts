import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  TASK_GRAPH_HISTORY_EVENT_TYPES,
  type MissionTaskGraphHistory,
  type MissionTaskGraphHistoryEntry,
  type TaskGraphHistoryEventType,
} from './task-graph-types.ts';

export const DEFAULT_TASK_GRAPH_ARTIFACTS_ROOT = path.join('artifacts', 'task-graph');

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

function compareEntries(left: MissionTaskGraphHistoryEntry, right: MissionTaskGraphHistoryEntry): number {
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

function parseEntry(value: unknown): MissionTaskGraphHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('TASK_GRAPH_INVALID_HISTORY_ENTRY');
  }

  const taskGraphId = asString(value.taskGraphId);
  const executionEngineRunId = asString(value.executionEngineRunId);
  const executionAttemptId = asString(value.executionAttemptId);
  const runtimeEnvelopeId = asString(value.runtimeEnvelopeId);
  const executionContractId = asString(value.executionContractId);
  const missionId = asString(value.missionId);
  const eventIndex = asInteger(value.eventIndex);
  const eventType = asString(value.eventType) as TaskGraphHistoryEventType | null;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reasoning = asString(value.reasoning);

  if (
    !taskGraphId
    || !executionEngineRunId
    || !executionAttemptId
    || !runtimeEnvelopeId
    || !executionContractId
    || !missionId
    || eventIndex === null
    || !eventType
    || !TASK_GRAPH_HISTORY_EVENT_TYPES.includes(eventType)
    || !eventDedupeKey
    || !reasoning
    || !isRecord(value.eventPayload)
  ) {
    throw new Error('TASK_GRAPH_INVALID_HISTORY_ENTRY');
  }

  return {
    taskGraphId,
    executionEngineRunId,
    executionAttemptId,
    runtimeEnvelopeId,
    executionContractId,
    missionId,
    eventIndex,
    eventType,
    eventDedupeKey,
    reasoning,
    eventPayload: normalizePayload(value.eventPayload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionTaskGraphHistory): MissionTaskGraphHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('TASK_GRAPH_INVALID_HISTORY');
  }

  const taskGraphId = asString(parsed.taskGraphId);
  const executionEngineRunId = asString(parsed.executionEngineRunId);
  const executionAttemptId = asString(parsed.executionAttemptId);
  const runtimeEnvelopeId = asString(parsed.runtimeEnvelopeId);
  const executionContractId = asString(parsed.executionContractId);
  const missionId = asString(parsed.missionId);

  if (!taskGraphId || !executionEngineRunId || !executionAttemptId || !runtimeEnvelopeId || !executionContractId || !missionId) {
    throw new Error('TASK_GRAPH_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    taskGraphId,
    executionEngineRunId,
    executionAttemptId,
    runtimeEnvelopeId,
    executionContractId,
    missionId,
    entries,
  };
}

function computeNextEventIndex(entries: MissionTaskGraphHistoryEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }

  return Math.max(...entries.map((entry) => entry.eventIndex)) + 1;
}

export function resolveTaskGraphArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_TASK_GRAPH_ARTIFACTS_ROOT);
}

export function resolveTaskGraphArtifactDir(input: { taskGraphId: string; rootDir?: string }): string {
  const taskGraphId = normalizeRelativeSegment(input.taskGraphId, 'task_graph_id');
  return path.join(resolveTaskGraphArtifactsRoot(input.rootDir), taskGraphId);
}

export function ensureTaskGraphArtifactDir(input: { taskGraphId: string; rootDir?: string }): string {
  const dirPath = resolveTaskGraphArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveTaskGraphArtifactPaths(input: {
  taskGraphId: string;
  rootDir?: string;
}): {
  dirPath: string;
  statusJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
  nodesJsonPath: string;
  edgesJsonPath: string;
} {
  const dirPath = resolveTaskGraphArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'task-graph-status.json'),
    reportJsonPath: path.join(dirPath, 'task-graph-report.json'),
    reportMarkdownPath: path.join(dirPath, 'task-graph-report.md'),
    historyJsonPath: path.join(dirPath, 'task-graph-history.json'),
    nodesJsonPath: path.join(dirPath, 'task-graph-nodes.json'),
    edgesJsonPath: path.join(dirPath, 'task-graph-edges.json'),
  };
}

export function computeTaskGraphEventDedupeKey(input: {
  taskGraphId: string;
  executionEngineRunId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  eventType: TaskGraphHistoryEventType;
  reasoning: string;
  eventPayload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    taskGraphId: input.taskGraphId,
    executionEngineRunId: input.executionEngineRunId,
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: input.eventType,
    reasoning: input.reasoning,
    eventPayload: normalizePayload(input.eventPayload),
  }));
}

export function createTaskGraphHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: {
    taskGraphId: string;
    executionEngineRunId: string;
    executionAttemptId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
  }): MissionTaskGraphHistory {
    const paths = resolveTaskGraphArtifactPaths({
      taskGraphId: input.taskGraphId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      taskGraphId: input.taskGraphId,
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      entries: [],
    });
  }

  function loadByTaskGraphId(input: { taskGraphId: string }): MissionTaskGraphHistory | null {
    const paths = resolveTaskGraphArtifactPaths({
      taskGraphId: input.taskGraphId,
      rootDir: options.artifactsRoot,
    });

    if (!fs.existsSync(paths.historyJsonPath)) {
      return null;
    }

    return readHistoryFile(paths.historyJsonPath, {
      taskGraphId: input.taskGraphId,
      executionEngineRunId: '',
      executionAttemptId: '',
      runtimeEnvelopeId: '',
      executionContractId: '',
      missionId: '',
      entries: [],
    });
  }

  function append(input: {
    taskGraphId: string;
    executionEngineRunId: string;
    executionAttemptId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
    eventType: TaskGraphHistoryEventType;
    reasoning: string;
    eventPayload: Record<string, unknown>;
  }): {
    history: MissionTaskGraphHistory;
    appended: boolean;
    entry: MissionTaskGraphHistoryEntry;
  } {
    ensureTaskGraphArtifactDir({
      taskGraphId: input.taskGraphId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveTaskGraphArtifactPaths({
      taskGraphId: input.taskGraphId,
      rootDir: options.artifactsRoot,
    });

    const current = load({
      taskGraphId: input.taskGraphId,
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
    });

    const eventPayload = normalizePayload(input.eventPayload);
    const eventDedupeKey = computeTaskGraphEventDedupeKey({
      taskGraphId: input.taskGraphId,
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventType: input.eventType,
      reasoning: input.reasoning,
      eventPayload,
    });

    const entry: MissionTaskGraphHistoryEntry = {
      taskGraphId: input.taskGraphId,
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventIndex: computeNextEventIndex(current.entries),
      eventType: input.eventType,
      eventDedupeKey,
      reasoning: input.reasoning,
      eventPayload,
    };

    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionTaskGraphHistory = {
      taskGraphId: input.taskGraphId,
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function write(history: MissionTaskGraphHistory): string {
    ensureTaskGraphArtifactDir({
      taskGraphId: history.taskGraphId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveTaskGraphArtifactPaths({
      taskGraphId: history.taskGraphId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionTaskGraphHistory = {
      taskGraphId: history.taskGraphId,
      executionEngineRunId: history.executionEngineRunId,
      executionAttemptId: history.executionAttemptId,
      runtimeEnvelopeId: history.runtimeEnvelopeId,
      executionContractId: history.executionContractId,
      missionId: history.missionId,
      entries: [...history.entries].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    load,
    loadByTaskGraphId,
    append,
    write,
  };
}

export type TaskGraphHistoryStore = ReturnType<typeof createTaskGraphHistoryStore>;
