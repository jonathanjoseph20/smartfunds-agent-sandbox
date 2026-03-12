import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionExecutionAttemptHistory,
  MissionExecutionAttemptHistoryEntry,
  MissionExecutionAttemptHistoryEventType,
} from './execution-attempt-types.ts';

export const DEFAULT_EXECUTION_ATTEMPT_ARTIFACTS_ROOT = path.join('artifacts', 'execution-attempt');

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

function compareEntries(left: MissionExecutionAttemptHistoryEntry, right: MissionExecutionAttemptHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): MissionExecutionAttemptHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('EXECUTION_ATTEMPT_INVALID_HISTORY_ENTRY');
  }

  const executionAttemptId = asString(value.executionAttemptId);
  const runtimeEnvelopeId = asString(value.runtimeEnvelopeId);
  const executionContractId = asString(value.executionContractId);
  const missionId = asString(value.missionId);
  const eventType = asString(value.eventType) as MissionExecutionAttemptHistoryEventType;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reasoning = asString(value.reasoning);

  if (!executionAttemptId || !runtimeEnvelopeId || !executionContractId || !missionId || !eventType || !eventDedupeKey || !reasoning || !isRecord(value.payload)) {
    throw new Error('EXECUTION_ATTEMPT_INVALID_HISTORY_ENTRY');
  }

  return {
    executionAttemptId,
    runtimeEnvelopeId,
    executionContractId,
    missionId,
    eventType,
    eventDedupeKey,
    reasoning,
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionExecutionAttemptHistory): MissionExecutionAttemptHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('EXECUTION_ATTEMPT_INVALID_HISTORY');
  }

  const executionAttemptId = asString(parsed.executionAttemptId);
  const runtimeEnvelopeId = asString(parsed.runtimeEnvelopeId);
  const executionContractId = asString(parsed.executionContractId);
  const missionId = asString(parsed.missionId);

  if (!executionAttemptId || !runtimeEnvelopeId || !executionContractId || !missionId) {
    throw new Error('EXECUTION_ATTEMPT_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    executionAttemptId,
    runtimeEnvelopeId,
    executionContractId,
    missionId,
    entries,
  };
}

export function resolveExecutionAttemptArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_EXECUTION_ATTEMPT_ARTIFACTS_ROOT);
}

export function resolveExecutionAttemptArtifactDir(input: { executionAttemptId: string; rootDir?: string }): string {
  const executionAttemptId = normalizeRelativeSegment(input.executionAttemptId, 'execution_attempt_id');
  return path.join(resolveExecutionAttemptArtifactsRoot(input.rootDir), executionAttemptId);
}

export function ensureExecutionAttemptArtifactDir(input: { executionAttemptId: string; rootDir?: string }): string {
  const dirPath = resolveExecutionAttemptArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveExecutionAttemptArtifactPaths(input: {
  executionAttemptId: string;
  rootDir?: string;
}): {
  dirPath: string;
  statusJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
  inputsJsonPath: string;
  capabilitiesJsonPath: string;
} {
  const dirPath = resolveExecutionAttemptArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'execution-attempt-status.json'),
    reportJsonPath: path.join(dirPath, 'execution-attempt-report.json'),
    reportMarkdownPath: path.join(dirPath, 'execution-attempt-report.md'),
    historyJsonPath: path.join(dirPath, 'execution-attempt-history.json'),
    inputsJsonPath: path.join(dirPath, 'execution-attempt-inputs.json'),
    capabilitiesJsonPath: path.join(dirPath, 'execution-attempt-capabilities.json'),
  };
}

export function computeExecutionAttemptEventDedupeKey(input: {
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  eventType: MissionExecutionAttemptHistoryEventType;
  reasoning: string;
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: input.eventType,
    reasoning: input.reasoning,
    payload: normalizePayload(input.payload),
  }));
}

export function createExecutionAttemptHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: {
    executionAttemptId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
  }): MissionExecutionAttemptHistory {
    const paths = resolveExecutionAttemptArtifactPaths({
      executionAttemptId: input.executionAttemptId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      entries: [],
    });
  }

  function loadByExecutionAttemptId(input: { executionAttemptId: string }): MissionExecutionAttemptHistory | null {
    const paths = resolveExecutionAttemptArtifactPaths({
      executionAttemptId: input.executionAttemptId,
      rootDir: options.artifactsRoot,
    });

    if (!fs.existsSync(paths.historyJsonPath)) {
      return null;
    }

    return readHistoryFile(paths.historyJsonPath, {
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: '',
      executionContractId: '',
      missionId: '',
      entries: [],
    });
  }

  function append(input: {
    executionAttemptId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
    eventType: MissionExecutionAttemptHistoryEventType;
    reasoning: string;
    payload: Record<string, unknown>;
  }): {
    history: MissionExecutionAttemptHistory;
    appended: boolean;
    entry: MissionExecutionAttemptHistoryEntry;
  } {
    ensureExecutionAttemptArtifactDir({
      executionAttemptId: input.executionAttemptId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveExecutionAttemptArtifactPaths({
      executionAttemptId: input.executionAttemptId,
      rootDir: options.artifactsRoot,
    });

    const entry: MissionExecutionAttemptHistoryEntry = {
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventType: input.eventType,
      reasoning: input.reasoning,
      payload: normalizePayload(input.payload),
      eventDedupeKey: computeExecutionAttemptEventDedupeKey(input),
    };

    const current = load({
      executionAttemptId: input.executionAttemptId,
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

    const next: MissionExecutionAttemptHistory = {
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

  function write(history: MissionExecutionAttemptHistory): string {
    ensureExecutionAttemptArtifactDir({
      executionAttemptId: history.executionAttemptId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveExecutionAttemptArtifactPaths({
      executionAttemptId: history.executionAttemptId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionExecutionAttemptHistory = {
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
    loadByExecutionAttemptId,
    append,
    write,
  };
}

export type ExecutionAttemptHistoryStore = ReturnType<typeof createExecutionAttemptHistoryStore>;
