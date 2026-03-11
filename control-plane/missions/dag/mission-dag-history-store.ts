import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../../finance/determinism.ts';

import type { MissionDAGHistory, MissionDAGHistoryEntry, MissionDAGHistoryEventType } from './mission-dag-types.ts';

export const DEFAULT_MISSION_DAG_ARTIFACTS_ROOT = path.join('artifacts', 'mission-dags');

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

function compareEntries(left: MissionDAGHistoryEntry, right: MissionDAGHistoryEntry): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }

  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): MissionDAGHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_DAG_INVALID_HISTORY_ENTRY');
  }

  const dagId = asString(value.dagId);
  const eventType = asString(value.eventType) as MissionDAGHistoryEventType;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reasoning = asString(value.reasoning);

  if (!dagId || !eventType || !eventDedupeKey || !reasoning || !isRecord(value.payload)) {
    throw new Error('MISSION_DAG_INVALID_HISTORY_ENTRY');
  }

  return {
    dagId,
    eventType,
    eventDedupeKey,
    reasoning,
    payload: normalizePayload(value.payload),
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {}),
  };
}

function readHistoryFile(filePath: string, fallback: MissionDAGHistory): MissionDAGHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_DAG_INVALID_HISTORY');
  }

  const dagId = asString(parsed.dagId);
  if (!dagId) {
    throw new Error('MISSION_DAG_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    dagId,
    entries,
  };
}

export function resolveMissionDAGArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_MISSION_DAG_ARTIFACTS_ROOT);
}

export function resolveMissionDAGArtifactDir(input: { dagId: string; rootDir?: string }): string {
  const dagId = normalizeRelativeSegment(input.dagId, 'dag_id');
  return path.join(resolveMissionDAGArtifactsRoot(input.rootDir), dagId);
}

export function ensureMissionDAGArtifactDir(input: { dagId: string; rootDir?: string }): string {
  const dirPath = resolveMissionDAGArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionDAGArtifactPaths(input: { dagId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  treeJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
} {
  const dirPath = resolveMissionDAGArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'dag-status.json'),
    treeJsonPath: path.join(dirPath, 'dag-tree.json'),
    reportMarkdownPath: path.join(dirPath, 'dag-report.md'),
    historyJsonPath: path.join(dirPath, 'dag-history.json'),
  };
}

export function computeMissionDAGEventDedupeKey(input: {
  dagId: string;
  eventType: MissionDAGHistoryEventType;
  payload: Record<string, unknown>;
  reasoning: string;
  slotReference?: string;
}): string {
  return sha256(canonicalStringify({
    dagId: input.dagId,
    eventType: input.eventType,
    payload: normalizePayload(input.payload),
    reasoning: input.reasoning,
    slotReference: input.slotReference ?? '',
  }));
}

export function createMissionDAGHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(dagId: string): MissionDAGHistory {
    const paths = resolveMissionDAGArtifactPaths({
      dagId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      dagId,
      entries: [],
    });
  }

  function append(input: {
    dagId: string;
    eventType: MissionDAGHistoryEventType;
    payload: Record<string, unknown>;
    reasoning: string;
    slotReference?: string;
  }): {
    history: MissionDAGHistory;
    appended: boolean;
    entry: MissionDAGHistoryEntry;
  } {
    ensureMissionDAGArtifactDir({
      dagId: input.dagId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionDAGArtifactPaths({
      dagId: input.dagId,
      rootDir: options.artifactsRoot,
    });

    const eventDedupeKey = computeMissionDAGEventDedupeKey(input);
    const entry: MissionDAGHistoryEntry = {
      dagId: input.dagId,
      eventType: input.eventType,
      eventDedupeKey,
      payload: normalizePayload(input.payload),
      reasoning: input.reasoning,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    };

    const current = load(input.dagId);
    if (current.entries.some((row) => row.eventDedupeKey === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionDAGHistory = {
      dagId: input.dagId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function write(history: MissionDAGHistory): string {
    ensureMissionDAGArtifactDir({
      dagId: history.dagId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionDAGArtifactPaths({
      dagId: history.dagId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionDAGHistory = {
      dagId: history.dagId,
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

export type MissionDAGHistoryStore = ReturnType<typeof createMissionDAGHistoryStore>;
