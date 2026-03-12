import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionExecutionContractHistory,
  MissionExecutionContractHistoryEntry,
  MissionExecutionContractHistoryEventType,
} from './execution-contract-types.ts';

export const DEFAULT_EXECUTION_CONTRACT_ARTIFACTS_ROOT = path.join('artifacts', 'execution-contract');

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

function compareEntries(left: MissionExecutionContractHistoryEntry, right: MissionExecutionContractHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): MissionExecutionContractHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('EXECUTION_CONTRACT_INVALID_HISTORY_ENTRY');
  }

  const executionContractId = asString(value.executionContractId);
  const missionId = asString(value.missionId);
  const eventType = asString(value.eventType) as MissionExecutionContractHistoryEventType;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reasoning = asString(value.reasoning);

  if (!executionContractId || !missionId || !eventType || !eventDedupeKey || !reasoning || !isRecord(value.payload)) {
    throw new Error('EXECUTION_CONTRACT_INVALID_HISTORY_ENTRY');
  }

  return {
    executionContractId,
    missionId,
    eventType,
    eventDedupeKey,
    reasoning,
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionExecutionContractHistory): MissionExecutionContractHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('EXECUTION_CONTRACT_INVALID_HISTORY');
  }

  const executionContractId = asString(parsed.executionContractId);
  const missionId = asString(parsed.missionId);

  if (!executionContractId || !missionId) {
    throw new Error('EXECUTION_CONTRACT_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    executionContractId,
    missionId,
    entries,
  };
}

export function resolveExecutionContractArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_EXECUTION_CONTRACT_ARTIFACTS_ROOT);
}

export function resolveExecutionContractArtifactDir(input: { executionContractId: string; rootDir?: string }): string {
  const executionContractId = normalizeRelativeSegment(input.executionContractId, 'execution_contract_id');
  return path.join(resolveExecutionContractArtifactsRoot(input.rootDir), executionContractId);
}

export function ensureExecutionContractArtifactDir(input: { executionContractId: string; rootDir?: string }): string {
  const dirPath = resolveExecutionContractArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveExecutionContractArtifactPaths(input: {
  executionContractId: string;
  rootDir?: string;
}): {
  dirPath: string;
  statusJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
  preconditionsJsonPath: string;
  runtimeEnvelopeJsonPath: string;
} {
  const dirPath = resolveExecutionContractArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'execution-contract-status.json'),
    reportJsonPath: path.join(dirPath, 'execution-contract-report.json'),
    reportMarkdownPath: path.join(dirPath, 'execution-contract-report.md'),
    historyJsonPath: path.join(dirPath, 'execution-contract-history.json'),
    preconditionsJsonPath: path.join(dirPath, 'execution-contract-preconditions.json'),
    runtimeEnvelopeJsonPath: path.join(dirPath, 'execution-runtime-envelope.json'),
  };
}

export function computeExecutionContractEventDedupeKey(input: {
  executionContractId: string;
  missionId: string;
  eventType: MissionExecutionContractHistoryEventType;
  reasoning: string;
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: input.eventType,
    reasoning: input.reasoning,
    payload: normalizePayload(input.payload),
  }));
}

export function createExecutionContractHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: { executionContractId: string; missionId: string }): MissionExecutionContractHistory {
    const paths = resolveExecutionContractArtifactPaths({
      executionContractId: input.executionContractId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      entries: [],
    });
  }

  function append(input: {
    executionContractId: string;
    missionId: string;
    eventType: MissionExecutionContractHistoryEventType;
    reasoning: string;
    payload: Record<string, unknown>;
  }): {
    history: MissionExecutionContractHistory;
    appended: boolean;
    entry: MissionExecutionContractHistoryEntry;
  } {
    ensureExecutionContractArtifactDir({
      executionContractId: input.executionContractId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveExecutionContractArtifactPaths({
      executionContractId: input.executionContractId,
      rootDir: options.artifactsRoot,
    });

    const entry: MissionExecutionContractHistoryEntry = {
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventType: input.eventType,
      reasoning: input.reasoning,
      payload: normalizePayload(input.payload),
      eventDedupeKey: computeExecutionContractEventDedupeKey(input),
    };

    const current = load({
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

    const next: MissionExecutionContractHistory = {
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

  function write(history: MissionExecutionContractHistory): string {
    ensureExecutionContractArtifactDir({
      executionContractId: history.executionContractId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveExecutionContractArtifactPaths({
      executionContractId: history.executionContractId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionExecutionContractHistory = {
      executionContractId: history.executionContractId,
      missionId: history.missionId,
      entries: [...history.entries].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    load,
    append,
    write,
  };
}

export type ExecutionContractHistoryStore = ReturnType<typeof createExecutionContractHistoryStore>;
