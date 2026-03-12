import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionRunHistory,
  MissionRunHistoryEntry,
  MissionRunHistoryEventType,
} from './mission-run-types.ts';

export const DEFAULT_MISSION_CONTROL_ARTIFACTS_ROOT = path.join('artifacts', 'mission-control');

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

function compareEntries(left: MissionRunHistoryEntry, right: MissionRunHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): MissionRunHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_RUN_INVALID_HISTORY_ENTRY');
  }

  const missionRunId = asString(value.missionRunId);
  const missionId = asString(value.missionId);
  const executionAttemptId = asString(value.executionAttemptId);
  const runtimeEnvelopeId = asString(value.runtimeEnvelopeId);
  const executionContractId = asString(value.executionContractId);
  const eventType = asString(value.eventType) as MissionRunHistoryEventType | null;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reason = asString(value.reason);

  if (!missionRunId || !missionId || !executionAttemptId || !runtimeEnvelopeId || !executionContractId || !eventType || !eventDedupeKey || !reason || !isRecord(value.payload)) {
    throw new Error('MISSION_RUN_INVALID_HISTORY_ENTRY');
  }

  return {
    missionRunId,
    missionId,
    executionAttemptId,
    runtimeEnvelopeId,
    executionContractId,
    eventType,
    eventDedupeKey,
    reason,
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionRunHistory): MissionRunHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_RUN_INVALID_HISTORY');
  }

  const missionRunId = asString(parsed.missionRunId);
  const missionId = asString(parsed.missionId);
  const executionAttemptId = asString(parsed.executionAttemptId);
  const runtimeEnvelopeId = asString(parsed.runtimeEnvelopeId);
  const executionContractId = asString(parsed.executionContractId);

  if (!missionRunId || !missionId || !executionAttemptId || !runtimeEnvelopeId || !executionContractId) {
    throw new Error('MISSION_RUN_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    missionRunId,
    missionId,
    executionAttemptId,
    runtimeEnvelopeId,
    executionContractId,
    entries,
  };
}

export function resolveMissionControlArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_MISSION_CONTROL_ARTIFACTS_ROOT);
}

export function resolveMissionRunArtifactDir(input: { missionRunId: string; rootDir?: string }): string {
  const missionRunId = normalizeRelativeSegment(input.missionRunId, 'mission_run_id');
  return path.join(resolveMissionControlArtifactsRoot(input.rootDir), missionRunId);
}

export function ensureMissionRunArtifactDir(input: { missionRunId: string; rootDir?: string }): string {
  const dirPath = resolveMissionRunArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionRunArtifactPaths(input: { missionRunId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  progressJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
  escalationsJsonPath: string;
  healthJsonPath: string;
} {
  const dirPath = resolveMissionRunArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'mission-run-status.json'),
    progressJsonPath: path.join(dirPath, 'mission-run-progress.json'),
    reportJsonPath: path.join(dirPath, 'mission-run-report.json'),
    reportMarkdownPath: path.join(dirPath, 'mission-run-report.md'),
    historyJsonPath: path.join(dirPath, 'mission-run-history.json'),
    escalationsJsonPath: path.join(dirPath, 'mission-run-escalations.json'),
    healthJsonPath: path.join(dirPath, 'mission-run-health.json'),
  };
}

export function computeMissionRunHistoryEventDedupeKey(input: {
  missionRunId: string;
  missionId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  eventType: MissionRunHistoryEventType;
  reason: string;
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    missionRunId: input.missionRunId,
    missionId: input.missionId,
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    eventType: input.eventType,
    reason: input.reason,
    payload: normalizePayload(input.payload),
  }));
}

export function createMissionRunHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: {
    missionRunId: string;
    missionId: string;
    executionAttemptId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
  }): MissionRunHistory {
    const paths = resolveMissionRunArtifactPaths({
      missionRunId: input.missionRunId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      missionRunId: input.missionRunId,
      missionId: input.missionId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      entries: [],
    });
  }

  function loadByMissionRunId(input: { missionRunId: string }): MissionRunHistory | null {
    const paths = resolveMissionRunArtifactPaths({
      missionRunId: input.missionRunId,
      rootDir: options.artifactsRoot,
    });

    if (!fs.existsSync(paths.historyJsonPath)) {
      return null;
    }

    return readHistoryFile(paths.historyJsonPath, {
      missionRunId: input.missionRunId,
      missionId: '',
      executionAttemptId: '',
      runtimeEnvelopeId: '',
      executionContractId: '',
      entries: [],
    });
  }

  function append(input: {
    missionRunId: string;
    missionId: string;
    executionAttemptId: string;
    runtimeEnvelopeId: string;
    executionContractId: string;
    eventType: MissionRunHistoryEventType;
    reason: string;
    payload: Record<string, unknown>;
  }): {
    history: MissionRunHistory;
    appended: boolean;
    entry: MissionRunHistoryEntry;
  } {
    ensureMissionRunArtifactDir({
      missionRunId: input.missionRunId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionRunArtifactPaths({
      missionRunId: input.missionRunId,
      rootDir: options.artifactsRoot,
    });

    const entry: MissionRunHistoryEntry = {
      missionRunId: input.missionRunId,
      missionId: input.missionId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      eventType: input.eventType,
      eventDedupeKey: computeMissionRunHistoryEventDedupeKey(input),
      reason: input.reason,
      payload: normalizePayload(input.payload),
    };

    const current = load({
      missionRunId: input.missionRunId,
      missionId: input.missionId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
    });

    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionRunHistory = {
      missionRunId: input.missionRunId,
      missionId: input.missionId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function write(history: MissionRunHistory): string {
    ensureMissionRunArtifactDir({
      missionRunId: history.missionRunId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionRunArtifactPaths({
      missionRunId: history.missionRunId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionRunHistory = {
      missionRunId: history.missionRunId,
      missionId: history.missionId,
      executionAttemptId: history.executionAttemptId,
      runtimeEnvelopeId: history.runtimeEnvelopeId,
      executionContractId: history.executionContractId,
      entries: [...history.entries].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    load,
    loadByMissionRunId,
    append,
    write,
  };
}

export type MissionRunHistoryStore = ReturnType<typeof createMissionRunHistoryStore>;
