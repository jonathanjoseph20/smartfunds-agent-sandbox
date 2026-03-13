import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  deriveMissionPortfolioResolutionHistoryEventDedupeKey,
  normalizeCanonicalRecord,
  uniqueSortedStrings,
} from './mission-portfolio-resolution-identity.ts';
import {
  MISSION_PORTFOLIO_RESOLUTION_HISTORY_EVENT_TYPES,
  type MissionPortfolioResolutionHistory,
  type MissionPortfolioResolutionHistoryEntry,
  type MissionPortfolioResolutionHistoryEventType,
} from './mission-portfolio-resolution-types.ts';
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

function parseEventType(value: unknown): MissionPortfolioResolutionHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return MISSION_PORTFOLIO_RESOLUTION_HISTORY_EVENT_TYPES.includes(parsed as MissionPortfolioResolutionHistoryEventType)
    ? (parsed as MissionPortfolioResolutionHistoryEventType)
    : null;
}

function parseEntry(value: unknown): MissionPortfolioResolutionHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_PORTFOLIO_RESOLUTION_INVALID_HISTORY_ENTRY');
  }

  const missionPortfolioId = asString(value.missionPortfolioId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!missionPortfolioId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('MISSION_PORTFOLIO_RESOLUTION_INVALID_HISTORY_ENTRY');
  }

  return {
    missionPortfolioId,
    eventType,
    eventDedupeKey,
    reasonTokens: uniqueSortedStrings(Array.isArray(value.reasonTokens) ? value.reasonTokens.filter((entry): entry is string => typeof entry === 'string') : []),
    payload: normalizeCanonicalRecord(value.payload),
  };
}

function compareEntries(left: MissionPortfolioResolutionHistoryEntry, right: MissionPortfolioResolutionHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function readHistoryFile(filePath: string, fallback: MissionPortfolioResolutionHistory): MissionPortfolioResolutionHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_PORTFOLIO_RESOLUTION_INVALID_HISTORY');
  }

  const missionPortfolioId = asString(parsed.missionPortfolioId);
  if (!missionPortfolioId) {
    throw new Error('MISSION_PORTFOLIO_RESOLUTION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    missionPortfolioId,
    entries,
  };
}

export function resolveMissionPortfolioResolutionArtifactDir(input: { missionPortfolioId: string; rootDir?: string }): string {
  const missionPortfolioId = normalizeRelativeSegment(input.missionPortfolioId, 'mission_portfolio_id');
  return path.join(path.resolve(input.rootDir ?? resolveMissionControlArtifactsRoot()), 'portfolios', missionPortfolioId);
}

export function ensureMissionPortfolioResolutionArtifactDir(input: { missionPortfolioId: string; rootDir?: string }): string {
  const dirPath = resolveMissionPortfolioResolutionArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionPortfolioResolutionArtifactPaths(input: { missionPortfolioId: string; rootDir?: string }): {
  dirPath: string;
  stabilizationJsonPath: string;
  resolutionStatusJsonPath: string;
  closureEligibilityJsonPath: string;
  resolutionQueueJsonPath: string;
  resolutionActionHistoryJsonPath: string;
  closureStateJsonPath: string;
  resolutionOutcomeJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
} {
  const dirPath = resolveMissionPortfolioResolutionArtifactDir(input);

  return {
    dirPath,
    stabilizationJsonPath: path.join(dirPath, 'mission-portfolio-stabilization.json'),
    resolutionStatusJsonPath: path.join(dirPath, 'mission-portfolio-resolution-status.json'),
    closureEligibilityJsonPath: path.join(dirPath, 'mission-portfolio-closure-eligibility.json'),
    resolutionQueueJsonPath: path.join(dirPath, 'mission-portfolio-resolution-queue.json'),
    resolutionActionHistoryJsonPath: path.join(dirPath, 'mission-portfolio-resolution-action-history.json'),
    closureStateJsonPath: path.join(dirPath, 'mission-portfolio-closure-state.json'),
    resolutionOutcomeJsonPath: path.join(dirPath, 'mission-portfolio-resolution-outcome.json'),
    reportJsonPath: path.join(dirPath, 'mission-portfolio-resolution-report.json'),
    reportMarkdownPath: path.join(dirPath, 'mission-portfolio-resolution-report.md'),
    historyJsonPath: path.join(dirPath, 'mission-portfolio-resolution-history.json'),
  };
}

export function createMissionPortfolioResolutionHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? resolveMissionControlArtifactsRoot());

  function load(input: { missionPortfolioId: string }): MissionPortfolioResolutionHistory {
    const paths = resolveMissionPortfolioResolutionArtifactPaths({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      missionPortfolioId: input.missionPortfolioId,
      entries: [],
    });
  }

  function appendEvent(input: {
    missionPortfolioId: string;
    eventType: MissionPortfolioResolutionHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): { history: MissionPortfolioResolutionHistory; appended: boolean; entry: MissionPortfolioResolutionHistoryEntry } {
    ensureMissionPortfolioResolutionArtifactDir({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    const entry: MissionPortfolioResolutionHistoryEntry = {
      missionPortfolioId: input.missionPortfolioId,
      eventType: input.eventType,
      eventDedupeKey: deriveMissionPortfolioResolutionHistoryEventDedupeKey(input),
      reasonTokens: uniqueSortedStrings(input.reasonTokens),
      payload: normalizeCanonicalRecord(input.payload),
    };

    const current = load({ missionPortfolioId: input.missionPortfolioId });
    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionPortfolioResolutionHistory = {
      missionPortfolioId: input.missionPortfolioId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    const paths = resolveMissionPortfolioResolutionArtifactPaths({
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

  function replay(input: { missionPortfolioId: string }): MissionPortfolioResolutionHistoryEntry[] {
    return [...load(input).entries].sort(compareEntries);
  }

  function write(history: MissionPortfolioResolutionHistory): string {
    ensureMissionPortfolioResolutionArtifactDir({
      missionPortfolioId: history.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    const normalized: MissionPortfolioResolutionHistory = {
      missionPortfolioId: history.missionPortfolioId,
      entries: [...history.entries].sort(compareEntries),
    };

    const paths = resolveMissionPortfolioResolutionArtifactPaths({
      missionPortfolioId: history.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    appendEvent,
    load,
    replay,
    write,
  };
}

export type MissionPortfolioResolutionHistoryStore = ReturnType<typeof createMissionPortfolioResolutionHistoryStore>;
