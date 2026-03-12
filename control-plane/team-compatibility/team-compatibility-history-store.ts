import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  TeamCompatibilityHistory,
  TeamCompatibilityHistoryEntry,
  TeamCompatibilityHistoryEventType,
} from './team-compatibility-types.ts';

export const DEFAULT_TEAM_COMPATIBILITY_ARTIFACTS_ROOT = path.join('artifacts', 'team-compatibility');

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

function compareEntries(left: TeamCompatibilityHistoryEntry, right: TeamCompatibilityHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): TeamCompatibilityHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('TEAM_COMPATIBILITY_INVALID_HISTORY_ENTRY');
  }

  const compatibilitySetId = asString(value.compatibilitySetId);
  const missionId = asString(value.missionId);
  const eventType = asString(value.eventType) as TeamCompatibilityHistoryEventType;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reasoning = asString(value.reasoning);

  if (!compatibilitySetId || !missionId || !eventType || !eventDedupeKey || !reasoning || !isRecord(value.payload)) {
    throw new Error('TEAM_COMPATIBILITY_INVALID_HISTORY_ENTRY');
  }

  return {
    compatibilitySetId,
    missionId,
    eventType,
    eventDedupeKey,
    reasoning,
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: TeamCompatibilityHistory): TeamCompatibilityHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('TEAM_COMPATIBILITY_INVALID_HISTORY');
  }

  const compatibilitySetId = asString(parsed.compatibilitySetId);
  const missionId = asString(parsed.missionId);

  if (!compatibilitySetId || !missionId) {
    throw new Error('TEAM_COMPATIBILITY_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    compatibilitySetId,
    missionId,
    entries,
  };
}

export function resolveTeamCompatibilityArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_TEAM_COMPATIBILITY_ARTIFACTS_ROOT);
}

export function resolveTeamCompatibilityArtifactDir(input: { compatibilitySetId: string; rootDir?: string }): string {
  const compatibilitySetId = normalizeRelativeSegment(input.compatibilitySetId, 'compatibility_set_id');
  return path.join(resolveTeamCompatibilityArtifactsRoot(input.rootDir), compatibilitySetId);
}

export function ensureTeamCompatibilityArtifactDir(input: { compatibilitySetId: string; rootDir?: string }): string {
  const dirPath = resolveTeamCompatibilityArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveTeamCompatibilityArtifactPaths(input: { compatibilitySetId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveTeamCompatibilityArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'compatibility-status.json'),
    historyJsonPath: path.join(dirPath, 'compatibility-history.json'),
    reportJsonPath: path.join(dirPath, 'compatibility-report.json'),
    reportMarkdownPath: path.join(dirPath, 'compatibility-report.md'),
  };
}

export function computeTeamCompatibilityEventDedupeKey(input: {
  compatibilitySetId: string;
  missionId: string;
  eventType: TeamCompatibilityHistoryEventType;
  reasoning: string;
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    compatibilitySetId: input.compatibilitySetId,
    missionId: input.missionId,
    eventType: input.eventType,
    reasoning: input.reasoning,
    payload: normalizePayload(input.payload),
  }));
}

export function createTeamCompatibilityHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: { compatibilitySetId: string; missionId: string }): TeamCompatibilityHistory {
    const paths = resolveTeamCompatibilityArtifactPaths({
      compatibilitySetId: input.compatibilitySetId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      compatibilitySetId: input.compatibilitySetId,
      missionId: input.missionId,
      entries: [],
    });
  }

  function append(input: {
    compatibilitySetId: string;
    missionId: string;
    eventType: TeamCompatibilityHistoryEventType;
    reasoning: string;
    payload: Record<string, unknown>;
  }): {
    history: TeamCompatibilityHistory;
    appended: boolean;
    entry: TeamCompatibilityHistoryEntry;
  } {
    ensureTeamCompatibilityArtifactDir({
      compatibilitySetId: input.compatibilitySetId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveTeamCompatibilityArtifactPaths({
      compatibilitySetId: input.compatibilitySetId,
      rootDir: options.artifactsRoot,
    });

    const entry: TeamCompatibilityHistoryEntry = {
      compatibilitySetId: input.compatibilitySetId,
      missionId: input.missionId,
      eventType: input.eventType,
      reasoning: input.reasoning,
      payload: normalizePayload(input.payload),
      eventDedupeKey: computeTeamCompatibilityEventDedupeKey(input),
    };

    const current = load({ compatibilitySetId: input.compatibilitySetId, missionId: input.missionId });

    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: TeamCompatibilityHistory = {
      compatibilitySetId: input.compatibilitySetId,
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

  function write(history: TeamCompatibilityHistory): string {
    ensureTeamCompatibilityArtifactDir({
      compatibilitySetId: history.compatibilitySetId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveTeamCompatibilityArtifactPaths({
      compatibilitySetId: history.compatibilitySetId,
      rootDir: options.artifactsRoot,
    });

    const normalized: TeamCompatibilityHistory = {
      compatibilitySetId: history.compatibilitySetId,
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

export type TeamCompatibilityHistoryStore = ReturnType<typeof createTeamCompatibilityHistoryStore>;
