import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import { deriveMissionPortfolioAttentionHistoryEventDedupeKey } from './mission-portfolio-attention-identity.ts';
import {
  MISSION_PORTFOLIO_ATTENTION_HISTORY_EVENT_TYPES,
  type MissionPortfolioAttentionHistory,
  type MissionPortfolioAttentionHistoryEntry,
  type MissionPortfolioAttentionHistoryEventType,
} from './mission-portfolio-attention-types.ts';
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

function parseEventType(value: unknown): MissionPortfolioAttentionHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return MISSION_PORTFOLIO_ATTENTION_HISTORY_EVENT_TYPES.includes(parsed as MissionPortfolioAttentionHistoryEventType)
    ? (parsed as MissionPortfolioAttentionHistoryEventType)
    : null;
}

function parseEntry(value: unknown): MissionPortfolioAttentionHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_PORTFOLIO_ATTENTION_INVALID_HISTORY_ENTRY');
  }

  const missionPortfolioId = asString(value.missionPortfolioId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!missionPortfolioId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('MISSION_PORTFOLIO_ATTENTION_INVALID_HISTORY_ENTRY');
  }

  return {
    missionPortfolioId,
    eventType,
    eventDedupeKey,
    reasonTokens: asStringArray(value.reasonTokens),
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionPortfolioAttentionHistory): MissionPortfolioAttentionHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_PORTFOLIO_ATTENTION_INVALID_HISTORY');
  }

  const missionPortfolioId = asString(parsed.missionPortfolioId);
  if (!missionPortfolioId) {
    throw new Error('MISSION_PORTFOLIO_ATTENTION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry))
    : [];

  return {
    missionPortfolioId,
    entries,
  };
}

export function resolveMissionPortfolioAttentionArtifactDir(input: { missionPortfolioId: string; rootDir?: string }): string {
  const missionPortfolioId = normalizeRelativeSegment(input.missionPortfolioId, 'mission_portfolio_id');
  return path.join(path.resolve(input.rootDir ?? resolveMissionControlArtifactsRoot()), 'portfolios', missionPortfolioId);
}

export function ensureMissionPortfolioAttentionArtifactDir(input: { missionPortfolioId: string; rootDir?: string }): string {
  const dirPath = resolveMissionPortfolioAttentionArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionPortfolioAttentionArtifactPaths(input: { missionPortfolioId: string; rootDir?: string }): {
  dirPath: string;
  requirementsJsonPath: string;
  statusJsonPath: string;
  queueJsonPath: string;
  escalationsJsonPath: string;
  actionHistoryJsonPath: string;
  actionOutcomeJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
} {
  const dirPath = resolveMissionPortfolioAttentionArtifactDir(input);

  return {
    dirPath,
    requirementsJsonPath: path.join(dirPath, 'mission-portfolio-attention-requirements.json'),
    statusJsonPath: path.join(dirPath, 'mission-portfolio-attention-status.json'),
    queueJsonPath: path.join(dirPath, 'mission-portfolio-attention-queue.json'),
    escalationsJsonPath: path.join(dirPath, 'mission-portfolio-escalations.json'),
    actionHistoryJsonPath: path.join(dirPath, 'mission-portfolio-action-history.json'),
    actionOutcomeJsonPath: path.join(dirPath, 'mission-portfolio-action-outcome.json'),
    reportJsonPath: path.join(dirPath, 'mission-portfolio-attention-report.json'),
    reportMarkdownPath: path.join(dirPath, 'mission-portfolio-attention-report.md'),
    historyJsonPath: path.join(dirPath, 'mission-portfolio-attention-history.json'),
  };
}

export function createMissionPortfolioAttentionHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? resolveMissionControlArtifactsRoot());

  function getEvents(input: { missionPortfolioId: string }): MissionPortfolioAttentionHistoryEntry[] {
    const paths = resolveMissionPortfolioAttentionArtifactPaths({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      missionPortfolioId: input.missionPortfolioId,
      entries: [],
    }).entries;
  }

  function appendEvent(input: {
    missionPortfolioId: string;
    eventType: MissionPortfolioAttentionHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): {
    history: MissionPortfolioAttentionHistory;
    appended: boolean;
    entry: MissionPortfolioAttentionHistoryEntry;
  } {
    ensureMissionPortfolioAttentionArtifactDir({
      missionPortfolioId: input.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    const entry: MissionPortfolioAttentionHistoryEntry = {
      missionPortfolioId: input.missionPortfolioId,
      eventType: input.eventType,
      eventDedupeKey: deriveMissionPortfolioAttentionHistoryEventDedupeKey(input),
      reasonTokens: asStringArray(input.reasonTokens ?? []),
      payload: normalizePayload(input.payload),
    };

    const current = getEvents({ missionPortfolioId: input.missionPortfolioId });
    if (current.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: {
          missionPortfolioId: input.missionPortfolioId,
          entries: current,
        },
        appended: false,
        entry,
      };
    }

    const next: MissionPortfolioAttentionHistory = {
      missionPortfolioId: input.missionPortfolioId,
      entries: [...current, entry],
    };

    const paths = resolveMissionPortfolioAttentionArtifactPaths({
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

  function replay(input: { missionPortfolioId: string }): MissionPortfolioAttentionHistoryEntry[] {
    return [...getEvents(input)];
  }

  function write(history: MissionPortfolioAttentionHistory): string {
    ensureMissionPortfolioAttentionArtifactDir({
      missionPortfolioId: history.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    const normalized: MissionPortfolioAttentionHistory = {
      missionPortfolioId: history.missionPortfolioId,
      entries: [...history.entries],
    };

    const paths = resolveMissionPortfolioAttentionArtifactPaths({
      missionPortfolioId: history.missionPortfolioId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    appendEvent,
    getEvents,
    replay,
    write,
  };
}

export type MissionPortfolioAttentionHistoryStore = ReturnType<typeof createMissionPortfolioAttentionHistoryStore>;
