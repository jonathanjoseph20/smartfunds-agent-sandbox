import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  MISSION_COORDINATION_HISTORY_EVENT_TYPES,
  type MissionCoordinationHistory,
  type MissionCoordinationHistoryEntry,
  type MissionCoordinationHistoryEventType,
} from './mission-coordination.ts';
import {
  resolveMissionControlArtifactsRoot,
  resolveMissionRunArtifactDir,
} from './mission-run-history-store.ts';

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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return [];
  }

  return Array.from(new Set(value.map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function parseEventType(value: unknown): MissionCoordinationHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return MISSION_COORDINATION_HISTORY_EVENT_TYPES.includes(parsed as MissionCoordinationHistoryEventType)
    ? (parsed as MissionCoordinationHistoryEventType)
    : null;
}

function parseEntry(value: unknown): MissionCoordinationHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_COORDINATION_INVALID_HISTORY_ENTRY');
  }

  const missionRunId = asString(value.missionRunId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!missionRunId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('MISSION_COORDINATION_INVALID_HISTORY_ENTRY');
  }

  return {
    missionRunId,
    eventType,
    eventDedupeKey,
    reasonTokens: asStringArray(value.reasonTokens),
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionCoordinationHistory): MissionCoordinationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_COORDINATION_INVALID_HISTORY');
  }

  const missionRunId = asString(parsed.missionRunId);
  if (!missionRunId) {
    throw new Error('MISSION_COORDINATION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry))
    : [];

  return {
    missionRunId,
    entries,
  };
}

export function resolveMissionCoordinationArtifactDir(input: { missionRunId: string; rootDir?: string }): string {
  const missionRunId = normalizeRelativeSegment(input.missionRunId, 'mission_run_id');
  if (input.rootDir) {
    return path.join(path.resolve(input.rootDir), missionRunId);
  }
  return resolveMissionRunArtifactDir({ missionRunId });
}

export function ensureMissionCoordinationArtifactDir(input: { missionRunId: string; rootDir?: string }): string {
  const dirPath = resolveMissionCoordinationArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionCoordinationArtifactPaths(input: { missionRunId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  lifecycleJsonPath: string;
  interventionsJsonPath: string;
  dependenciesJsonPath: string;
  priorityJsonPath: string;
  historyJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveMissionCoordinationArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'mission-coordination-status.json'),
    lifecycleJsonPath: path.join(dirPath, 'mission-lifecycle.json'),
    interventionsJsonPath: path.join(dirPath, 'mission-interventions.json'),
    dependenciesJsonPath: path.join(dirPath, 'mission-dependencies.json'),
    priorityJsonPath: path.join(dirPath, 'mission-priority.json'),
    historyJsonPath: path.join(dirPath, 'mission-coordination-history.json'),
    reportMarkdownPath: path.join(dirPath, 'mission-coordination-report.md'),
  };
}

export function computeMissionCoordinationHistoryEventDedupeKey(input: {
  missionRunId: string;
  eventType: MissionCoordinationHistoryEventType;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  const reasonTokens = asStringArray(input.reasonTokens ?? []);
  return sha256(canonicalStringify({
    missionRunId: input.missionRunId,
    eventType: input.eventType,
    reasonTokens,
    payload: normalizePayload(input.payload),
  }));
}

export function createMissionLifecycleHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = options.artifactsRoot
    ? path.resolve(options.artifactsRoot)
    : resolveMissionControlArtifactsRoot();

  function load(input: { missionRunId: string }): MissionCoordinationHistory {
    const paths = resolveMissionCoordinationArtifactPaths({
      missionRunId: input.missionRunId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      missionRunId: input.missionRunId,
      entries: [],
    });
  }

  function append(input: {
    missionRunId: string;
    eventType: MissionCoordinationHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): {
    history: MissionCoordinationHistory;
    appended: boolean;
    entry: MissionCoordinationHistoryEntry;
  } {
    ensureMissionCoordinationArtifactDir({
      missionRunId: input.missionRunId,
      rootDir: artifactsRoot,
    });

    const paths = resolveMissionCoordinationArtifactPaths({
      missionRunId: input.missionRunId,
      rootDir: artifactsRoot,
    });

    const entry: MissionCoordinationHistoryEntry = {
      missionRunId: input.missionRunId,
      eventType: input.eventType,
      eventDedupeKey: computeMissionCoordinationHistoryEventDedupeKey(input),
      reasonTokens: asStringArray(input.reasonTokens ?? []),
      payload: normalizePayload(input.payload),
    };

    const current = load({ missionRunId: input.missionRunId });
    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionCoordinationHistory = {
      missionRunId: input.missionRunId,
      entries: [...current.entries, entry],
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function replay(input: { missionRunId: string }): MissionCoordinationHistoryEntry[] {
    return [...load({ missionRunId: input.missionRunId }).entries];
  }

  function write(history: MissionCoordinationHistory): string {
    ensureMissionCoordinationArtifactDir({
      missionRunId: history.missionRunId,
      rootDir: artifactsRoot,
    });

    const paths = resolveMissionCoordinationArtifactPaths({
      missionRunId: history.missionRunId,
      rootDir: artifactsRoot,
    });

    const normalized: MissionCoordinationHistory = {
      missionRunId: history.missionRunId,
      entries: [...history.entries],
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    load,
    append,
    replay,
    write,
  };
}

export type MissionLifecycleHistoryStore = ReturnType<typeof createMissionLifecycleHistoryStore>;
