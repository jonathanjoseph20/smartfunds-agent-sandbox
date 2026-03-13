import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import { deriveMissionPortfolioHistoryEventDedupeKey } from './mission-portfolio-identity.ts';
import {
  MISSION_PORTFOLIO_HISTORY_EVENT_TYPES,
  type MissionPortfolioHistory,
  type MissionPortfolioHistoryEntry,
  type MissionPortfolioHistoryEventType,
} from './mission-portfolio-types.ts';
import { resolveMissionControlArtifactsRoot } from './mission-run-history-store.ts';

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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return [];
  }

  return Array.from(new Set(value.map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function normalizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

function parseEventType(value: unknown): MissionPortfolioHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return MISSION_PORTFOLIO_HISTORY_EVENT_TYPES.includes(parsed as MissionPortfolioHistoryEventType)
    ? (parsed as MissionPortfolioHistoryEventType)
    : null;
}

function parseEntry(value: unknown): MissionPortfolioHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_PORTFOLIO_INVALID_HISTORY_ENTRY');
  }

  const missionPortfolioId = asString(value.missionPortfolioId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!missionPortfolioId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('MISSION_PORTFOLIO_INVALID_HISTORY_ENTRY');
  }

  return {
    missionPortfolioId,
    eventType,
    eventDedupeKey,
    reasonTokens: asStringArray(value.reasonTokens),
    payload: normalizePayload(value.payload),
  };
}

function compareEntries(left: MissionPortfolioHistoryEntry, right: MissionPortfolioHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function readHistoryFile(filePath: string, fallback: MissionPortfolioHistory): MissionPortfolioHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_PORTFOLIO_INVALID_HISTORY');
  }

  const missionPortfolioId = asString(parsed.missionPortfolioId);
  if (!missionPortfolioId) {
    throw new Error('MISSION_PORTFOLIO_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    missionPortfolioId,
    entries,
  };
}

export function resolveMissionPortfolioArtifactDir(input: { missionPortfolioId: string; rootDir?: string }): string {
  const missionPortfolioId = normalizeRelativeSegment(input.missionPortfolioId, 'mission_portfolio_id');
  return path.join(path.resolve(input.rootDir ?? resolveMissionControlArtifactsRoot()), 'portfolios', missionPortfolioId);
}

export function ensureMissionPortfolioArtifactDir(input: { missionPortfolioId: string; rootDir?: string }): string {
  const dirPath = resolveMissionPortfolioArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionPortfolioArtifactPaths(input: { missionPortfolioId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  readinessJsonPath: string;
  healthJsonPath: string;
  governanceJsonPath: string;
  membershipJsonPath: string;
  blockingJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveMissionPortfolioArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'mission-portfolio-status.json'),
    readinessJsonPath: path.join(dirPath, 'mission-portfolio-readiness.json'),
    healthJsonPath: path.join(dirPath, 'mission-portfolio-health.json'),
    governanceJsonPath: path.join(dirPath, 'mission-portfolio-governance.json'),
    membershipJsonPath: path.join(dirPath, 'mission-portfolio-membership.json'),
    blockingJsonPath: path.join(dirPath, 'mission-portfolio-blocking.json'),
    historyJsonPath: path.join(dirPath, 'mission-portfolio-history.json'),
    reportJsonPath: path.join(dirPath, 'mission-portfolio-report.json'),
    reportMarkdownPath: path.join(dirPath, 'mission-portfolio-report.md'),
  };
}

export function createMissionPortfolioHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? resolveMissionControlArtifactsRoot());

  function load(input: { missionPortfolioId: string }): MissionPortfolioHistory {
    const paths = resolveMissionPortfolioArtifactPaths({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      missionPortfolioId: input.missionPortfolioId,
      entries: [],
    });
  }

  function append(input: {
    missionPortfolioId: string;
    eventType: MissionPortfolioHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): { history: MissionPortfolioHistory; appended: boolean; entry: MissionPortfolioHistoryEntry } {
    ensureMissionPortfolioArtifactDir({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    const entry: MissionPortfolioHistoryEntry = {
      missionPortfolioId: input.missionPortfolioId,
      eventType: input.eventType,
      eventDedupeKey: deriveMissionPortfolioHistoryEventDedupeKey(input),
      reasonTokens: asStringArray(input.reasonTokens ?? []),
      payload: normalizePayload(input.payload),
    };

    const current = load({ missionPortfolioId: input.missionPortfolioId });
    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionPortfolioHistory = {
      missionPortfolioId: input.missionPortfolioId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    const paths = resolveMissionPortfolioArtifactPaths({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function replay(input: { missionPortfolioId: string }): MissionPortfolioHistoryEntry[] {
    return [...load(input).entries].sort(compareEntries);
  }

  function write(history: MissionPortfolioHistory): string {
    ensureMissionPortfolioArtifactDir({
      missionPortfolioId: history.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    const normalized: MissionPortfolioHistory = {
      missionPortfolioId: history.missionPortfolioId,
      entries: [...history.entries].sort(compareEntries),
    };

    const paths = resolveMissionPortfolioArtifactPaths({
      missionPortfolioId: history.missionPortfolioId,
      rootDir: artifactsRoot,
    });

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

export type MissionPortfolioHistoryStore = ReturnType<typeof createMissionPortfolioHistoryStore>;
