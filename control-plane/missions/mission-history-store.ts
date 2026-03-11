import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { MissionHistoryEntry, MissionHistoryEventType } from './mission-types.ts';

export const DEFAULT_MISSION_ARTIFACTS_ROOT = path.join('artifacts', 'missions');

export interface MissionHistory {
  missionId: string;
  entries: MissionHistoryEntry[];
}

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

function compareEntries(left: MissionHistoryEntry, right: MissionHistoryEntry): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): MissionHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_INVALID_HISTORY_ENTRY');
  }

  const missionId = asString(value.missionId);
  const eventType = asString(value.eventType) as MissionHistoryEventType;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reasoning = asString(value.reasoning);

  if (!missionId || !eventType || !eventDedupeKey || !reasoning || !isRecord(value.payload)) {
    throw new Error('MISSION_INVALID_HISTORY_ENTRY');
  }

  return {
    missionId,
    eventType,
    eventDedupeKey,
    reasoning,
    payload: normalizePayload(value.payload),
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {}),
  };
}

function readHistoryFile(filePath: string, fallback: MissionHistory): MissionHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_INVALID_HISTORY');
  }

  const missionId = asString(parsed.missionId);
  if (!missionId) {
    throw new Error('MISSION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    missionId,
    entries,
  };
}

export function resolveMissionArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_MISSION_ARTIFACTS_ROOT);
}

export function resolveMissionArtifactDir(input: { missionId: string; rootDir?: string }): string {
  const missionId = normalizeRelativeSegment(input.missionId, 'mission_id');
  return path.join(resolveMissionArtifactsRoot(input.rootDir), missionId);
}

export function ensureMissionArtifactDir(input: { missionId: string; rootDir?: string }): string {
  const dirPath = resolveMissionArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionArtifactPaths(input: { missionId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveMissionArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'mission-status.json'),
    historyJsonPath: path.join(dirPath, 'mission-history.json'),
    reportJsonPath: path.join(dirPath, 'mission-report.json'),
    reportMarkdownPath: path.join(dirPath, 'mission-report.md'),
  };
}

export function computeMissionEventDedupeKey(input: {
  missionId: string;
  eventType: MissionHistoryEventType;
  payload: Record<string, unknown>;
  reasoning: string;
  slotReference?: string;
}): string {
  return sha256(canonicalStringify({
    missionId: input.missionId,
    eventType: input.eventType,
    payload: normalizePayload(input.payload),
    reasoning: input.reasoning,
    slotReference: input.slotReference ?? '',
  }));
}

export function createMissionHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(missionId: string): MissionHistory {
    const paths = resolveMissionArtifactPaths({
      missionId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      missionId,
      entries: [],
    });
  }

  function append(input: {
    missionId: string;
    eventType: MissionHistoryEventType;
    payload: Record<string, unknown>;
    reasoning: string;
    slotReference?: string;
  }): {
    history: MissionHistory;
    appended: boolean;
    entry: MissionHistoryEntry;
  } {
    ensureMissionArtifactDir({
      missionId: input.missionId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionArtifactPaths({
      missionId: input.missionId,
      rootDir: options.artifactsRoot,
    });

    const eventDedupeKey = computeMissionEventDedupeKey(input);
    const entry: MissionHistoryEntry = {
      missionId: input.missionId,
      eventType: input.eventType,
      eventDedupeKey,
      payload: normalizePayload(input.payload),
      reasoning: input.reasoning,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    };

    const current = load(input.missionId);
    if (current.entries.some((row) => row.eventDedupeKey === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionHistory = {
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

  function write(history: MissionHistory): string {
    ensureMissionArtifactDir({
      missionId: history.missionId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionArtifactPaths({
      missionId: history.missionId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionHistory = {
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

export type MissionHistoryStore = ReturnType<typeof createMissionHistoryStore>;
