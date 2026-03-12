import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionRuntimeEnvelopeHistory,
  MissionRuntimeEnvelopeHistoryEntry,
  MissionRuntimeEnvelopeHistoryEventType,
} from './runtime-envelope-types.ts';

export const DEFAULT_RUNTIME_ENVELOPE_ARTIFACTS_ROOT = path.join('artifacts', 'runtime-envelope');

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

function compareEntries(left: MissionRuntimeEnvelopeHistoryEntry, right: MissionRuntimeEnvelopeHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): MissionRuntimeEnvelopeHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('RUNTIME_ENVELOPE_INVALID_HISTORY_ENTRY');
  }

  const runtimeEnvelopeId = asString(value.runtimeEnvelopeId);
  const executionContractId = asString(value.executionContractId);
  const missionId = asString(value.missionId);
  const eventType = asString(value.eventType) as MissionRuntimeEnvelopeHistoryEventType;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reasoning = asString(value.reasoning);

  if (!runtimeEnvelopeId || !executionContractId || !missionId || !eventType || !eventDedupeKey || !reasoning || !isRecord(value.payload)) {
    throw new Error('RUNTIME_ENVELOPE_INVALID_HISTORY_ENTRY');
  }

  return {
    runtimeEnvelopeId,
    executionContractId,
    missionId,
    eventType,
    eventDedupeKey,
    reasoning,
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionRuntimeEnvelopeHistory): MissionRuntimeEnvelopeHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('RUNTIME_ENVELOPE_INVALID_HISTORY');
  }

  const runtimeEnvelopeId = asString(parsed.runtimeEnvelopeId);
  const executionContractId = asString(parsed.executionContractId);
  const missionId = asString(parsed.missionId);

  if (!runtimeEnvelopeId || !executionContractId || !missionId) {
    throw new Error('RUNTIME_ENVELOPE_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    runtimeEnvelopeId,
    executionContractId,
    missionId,
    entries,
  };
}

export function resolveRuntimeEnvelopeArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_RUNTIME_ENVELOPE_ARTIFACTS_ROOT);
}

export function resolveRuntimeEnvelopeArtifactDir(input: { runtimeEnvelopeId: string; rootDir?: string }): string {
  const runtimeEnvelopeId = normalizeRelativeSegment(input.runtimeEnvelopeId, 'runtime_envelope_id');
  return path.join(resolveRuntimeEnvelopeArtifactsRoot(input.rootDir), runtimeEnvelopeId);
}

export function ensureRuntimeEnvelopeArtifactDir(input: { runtimeEnvelopeId: string; rootDir?: string }): string {
  const dirPath = resolveRuntimeEnvelopeArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveRuntimeEnvelopeArtifactPaths(input: {
  runtimeEnvelopeId: string;
  rootDir?: string;
}): {
  dirPath: string;
  statusJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
  payloadJsonPath: string;
  capabilitiesJsonPath: string;
} {
  const dirPath = resolveRuntimeEnvelopeArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'runtime-envelope-status.json'),
    reportJsonPath: path.join(dirPath, 'runtime-envelope-report.json'),
    reportMarkdownPath: path.join(dirPath, 'runtime-envelope-report.md'),
    historyJsonPath: path.join(dirPath, 'runtime-envelope-history.json'),
    payloadJsonPath: path.join(dirPath, 'runtime-envelope-payload.json'),
    capabilitiesJsonPath: path.join(dirPath, 'runtime-envelope-capabilities.json'),
  };
}

export function computeRuntimeEnvelopeEventDedupeKey(input: {
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  eventType: MissionRuntimeEnvelopeHistoryEventType;
  reasoning: string;
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: input.eventType,
    reasoning: input.reasoning,
    payload: normalizePayload(input.payload),
  }));
}

export function createRuntimeEnvelopeHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: {
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
  }): MissionRuntimeEnvelopeHistory {
    const paths = resolveRuntimeEnvelopeArtifactPaths({
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      entries: [],
    });
  }

  function append(input: {
    runtimeEnvelopeId: string;
    executionContractId: string;
    missionId: string;
    eventType: MissionRuntimeEnvelopeHistoryEventType;
    reasoning: string;
    payload: Record<string, unknown>;
  }): {
    history: MissionRuntimeEnvelopeHistory;
    appended: boolean;
    entry: MissionRuntimeEnvelopeHistoryEntry;
  } {
    ensureRuntimeEnvelopeArtifactDir({
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveRuntimeEnvelopeArtifactPaths({
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      rootDir: options.artifactsRoot,
    });

    const entry: MissionRuntimeEnvelopeHistoryEntry = {
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      eventType: input.eventType,
      reasoning: input.reasoning,
      payload: normalizePayload(input.payload),
      eventDedupeKey: computeRuntimeEnvelopeEventDedupeKey(input),
    };

    const current = load({
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

    const next: MissionRuntimeEnvelopeHistory = {
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

  function write(history: MissionRuntimeEnvelopeHistory): string {
    ensureRuntimeEnvelopeArtifactDir({
      runtimeEnvelopeId: history.runtimeEnvelopeId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveRuntimeEnvelopeArtifactPaths({
      runtimeEnvelopeId: history.runtimeEnvelopeId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionRuntimeEnvelopeHistory = {
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
    append,
    write,
  };
}

export type RuntimeEnvelopeHistoryStore = ReturnType<typeof createRuntimeEnvelopeHistoryStore>;
