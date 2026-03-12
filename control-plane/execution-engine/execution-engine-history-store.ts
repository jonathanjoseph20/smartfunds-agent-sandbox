import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  ExecutionEngineHistoryEventType,
  MissionExecutionEngineHistory,
  MissionExecutionEngineHistoryEntry,
} from './execution-engine-types.ts';

export const DEFAULT_EXECUTION_ENGINE_ARTIFACTS_ROOT = path.join('artifacts', 'execution-engine');

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

function normalizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

function compareEntries(left: MissionExecutionEngineHistoryEntry, right: MissionExecutionEngineHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): MissionExecutionEngineHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('EXECUTION_ENGINE_INVALID_HISTORY_ENTRY');
  }

  const executionEngineRunId = asString(value.executionEngineRunId);
  const executionAttemptId = asString(value.executionAttemptId);
  const executionJournalId = asString(value.executionJournalId);
  const runtimeEnvelopeId = asString(value.runtimeEnvelopeId);
  const executionContractId = asString(value.executionContractId);
  const missionId = asString(value.missionId);
  const eventType = asString(value.eventType) as ExecutionEngineHistoryEventType;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reasoning = asString(value.reasoning);

  if (
    !executionEngineRunId
    || !executionAttemptId
    || !executionJournalId
    || !runtimeEnvelopeId
    || !executionContractId
    || !missionId
    || !eventType
    || !eventDedupeKey
    || !reasoning
    || !isRecord(value.payload)
  ) {
    throw new Error('EXECUTION_ENGINE_INVALID_HISTORY_ENTRY');
  }

  return {
    executionEngineRunId,
    executionAttemptId,
    executionJournalId,
    runtimeEnvelopeId,
    executionContractId,
    missionId,
    eventType,
    eventDedupeKey,
    reasoning,
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionExecutionEngineHistory): MissionExecutionEngineHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('EXECUTION_ENGINE_INVALID_HISTORY');
  }

  const executionEngineRunId = asString(parsed.executionEngineRunId);
  const executionAttemptId = asString(parsed.executionAttemptId);
  const executionJournalId = asString(parsed.executionJournalId);
  const runtimeEnvelopeId = asString(parsed.runtimeEnvelopeId);
  const executionContractId = asString(parsed.executionContractId);
  const missionId = asString(parsed.missionId);

  if (!executionEngineRunId || !executionAttemptId || !executionJournalId || !runtimeEnvelopeId || !executionContractId || !missionId) {
    throw new Error('EXECUTION_ENGINE_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    executionEngineRunId,
    executionAttemptId,
    executionJournalId,
    runtimeEnvelopeId,
    executionContractId,
    missionId,
    entries,
  };
}

export function resolveExecutionEngineArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_EXECUTION_ENGINE_ARTIFACTS_ROOT);
}

export function resolveExecutionEngineArtifactDir(input: { executionEngineRunId: string; rootDir?: string }): string {
  const executionEngineRunId = normalizeRelativeSegment(input.executionEngineRunId, 'execution_engine_run_id');
  return path.join(resolveExecutionEngineArtifactsRoot(input.rootDir), executionEngineRunId);
}

export function ensureExecutionEngineArtifactDir(input: { executionEngineRunId: string; rootDir?: string }): string {
  const dirPath = resolveExecutionEngineArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveExecutionEngineArtifactPaths(input: {
  executionEngineRunId: string;
  rootDir?: string;
}): {
  dirPath: string;
  statusJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
  outputsJsonPath: string;
} {
  const dirPath = resolveExecutionEngineArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'execution-engine-status.json'),
    reportJsonPath: path.join(dirPath, 'execution-engine-report.json'),
    reportMarkdownPath: path.join(dirPath, 'execution-engine-report.md'),
    historyJsonPath: path.join(dirPath, 'execution-engine-history.json'),
    outputsJsonPath: path.join(dirPath, 'execution-engine-outputs.json'),
  };
}

export function computeExecutionEngineEventDedupeKey(input: {
  executionEngineRunId: string;
  executionAttemptId: string;
  executionJournalId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  eventType: ExecutionEngineHistoryEventType;
  reasoning: string;
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    executionEngineRunId: input.executionEngineRunId,
    executionAttemptId: input.executionAttemptId,
    executionJournalId: input.executionJournalId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: input.eventType,
    reasoning: input.reasoning,
    payload: normalizePayload(input.payload),
  }));
}

export function createExecutionEngineHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: {
    executionEngineRunId: string;
    executionAttemptId: string;
    executionJournalId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
  }): MissionExecutionEngineHistory {
    const paths = resolveExecutionEngineArtifactPaths({
      executionEngineRunId: input.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      executionJournalId: input.executionJournalId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      entries: [],
    });
  }

  function loadByExecutionEngineRunId(input: { executionEngineRunId: string }): MissionExecutionEngineHistory | null {
    const paths = resolveExecutionEngineArtifactPaths({
      executionEngineRunId: input.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    if (!fs.existsSync(paths.historyJsonPath)) {
      return null;
    }

    return readHistoryFile(paths.historyJsonPath, {
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: '',
      executionJournalId: '',
      runtimeEnvelopeId: '',
      executionContractId: '',
      missionId: '',
      entries: [],
    });
  }

  function append(input: {
    executionEngineRunId: string;
    executionAttemptId: string;
    executionJournalId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
    eventType: ExecutionEngineHistoryEventType;
    reasoning: string;
    payload: Record<string, unknown>;
  }): {
    history: MissionExecutionEngineHistory;
    appended: boolean;
    entry: MissionExecutionEngineHistoryEntry;
  } {
    ensureExecutionEngineArtifactDir({
      executionEngineRunId: input.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveExecutionEngineArtifactPaths({
      executionEngineRunId: input.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    const entry: MissionExecutionEngineHistoryEntry = {
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      executionJournalId: input.executionJournalId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventType: input.eventType,
      reasoning: input.reasoning,
      payload: normalizePayload(input.payload),
      eventDedupeKey: computeExecutionEngineEventDedupeKey(input),
    };

    const current = load({
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      executionJournalId: input.executionJournalId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
    });

    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionExecutionEngineHistory = {
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      executionJournalId: input.executionJournalId,
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

  function write(history: MissionExecutionEngineHistory): string {
    ensureExecutionEngineArtifactDir({
      executionEngineRunId: history.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveExecutionEngineArtifactPaths({
      executionEngineRunId: history.executionEngineRunId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionExecutionEngineHistory = {
      executionEngineRunId: history.executionEngineRunId,
      executionAttemptId: history.executionAttemptId,
      executionJournalId: history.executionJournalId,
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
    loadByExecutionEngineRunId,
    append,
    write,
  };
}

export type ExecutionEngineHistoryStore = ReturnType<typeof createExecutionEngineHistoryStore>;
