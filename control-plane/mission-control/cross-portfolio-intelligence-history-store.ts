import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  deriveCrossPortfolioIntelligenceHistoryEventDedupeKey,
  normalizeCanonicalRecord,
  uniqueSortedStrings,
} from './cross-portfolio-mission-intelligence-identity.ts';
import {
  CROSS_PORTFOLIO_INTELLIGENCE_HISTORY_EVENT_TYPES,
  type CrossPortfolioIntelligenceHistoryEventType,
  type CrossPortfolioMissionIntelligenceHistory,
  type CrossPortfolioMissionIntelligenceHistoryEntry,
} from './cross-portfolio-mission-intelligence-types.ts';
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

function parseEventType(value: unknown): CrossPortfolioIntelligenceHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return CROSS_PORTFOLIO_INTELLIGENCE_HISTORY_EVENT_TYPES.includes(parsed as CrossPortfolioIntelligenceHistoryEventType)
    ? parsed as CrossPortfolioIntelligenceHistoryEventType
    : null;
}

function parseEntry(value: unknown): CrossPortfolioMissionIntelligenceHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('CROSS_PORTFOLIO_INTELLIGENCE_INVALID_HISTORY_ENTRY');
  }

  const crossPortfolioMissionIntelligenceSetId = asString(value.crossPortfolioMissionIntelligenceSetId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!crossPortfolioMissionIntelligenceSetId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('CROSS_PORTFOLIO_INTELLIGENCE_INVALID_HISTORY_ENTRY');
  }

  return {
    crossPortfolioMissionIntelligenceSetId,
    eventType,
    eventDedupeKey,
    reasonTokens: uniqueSortedStrings(Array.isArray(value.reasonTokens) ? value.reasonTokens.filter((entry): entry is string => typeof entry === 'string') : []),
    payload: normalizeCanonicalRecord(value.payload),
  };
}

function compareEntries(left: CrossPortfolioMissionIntelligenceHistoryEntry, right: CrossPortfolioMissionIntelligenceHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function readHistoryFile(filePath: string, fallback: CrossPortfolioMissionIntelligenceHistory): CrossPortfolioMissionIntelligenceHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('CROSS_PORTFOLIO_INTELLIGENCE_INVALID_HISTORY');
  }

  const crossPortfolioMissionIntelligenceSetId = asString(parsed.crossPortfolioMissionIntelligenceSetId);
  if (!crossPortfolioMissionIntelligenceSetId) {
    throw new Error('CROSS_PORTFOLIO_INTELLIGENCE_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    crossPortfolioMissionIntelligenceSetId,
    entries,
  };
}

export function resolveCrossPortfolioIntelligenceArtifactDir(input: { crossPortfolioMissionIntelligenceSetId: string; rootDir?: string }): string {
  const crossPortfolioMissionIntelligenceSetId = normalizeRelativeSegment(input.crossPortfolioMissionIntelligenceSetId, 'cross_portfolio_mission_intelligence_set_id');
  return path.join(path.resolve(input.rootDir ?? resolveMissionControlArtifactsRoot()), 'cross-portfolio', crossPortfolioMissionIntelligenceSetId);
}

export function ensureCrossPortfolioIntelligenceArtifactDir(input: { crossPortfolioMissionIntelligenceSetId: string; rootDir?: string }): string {
  const dirPath = resolveCrossPortfolioIntelligenceArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveCrossPortfolioIntelligenceArtifactPaths(input: { crossPortfolioMissionIntelligenceSetId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  sharedDependenciesJsonPath: string;
  blockingClustersJsonPath: string;
  escalationPatternsJsonPath: string;
  riskJsonPath: string;
  readinessJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveCrossPortfolioIntelligenceArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'cross-portfolio-intelligence-status.json'),
    sharedDependenciesJsonPath: path.join(dirPath, 'cross-portfolio-shared-dependencies.json'),
    blockingClustersJsonPath: path.join(dirPath, 'cross-portfolio-blocking-clusters.json'),
    escalationPatternsJsonPath: path.join(dirPath, 'cross-portfolio-escalation-patterns.json'),
    riskJsonPath: path.join(dirPath, 'cross-portfolio-risk.json'),
    readinessJsonPath: path.join(dirPath, 'cross-portfolio-readiness.json'),
    historyJsonPath: path.join(dirPath, 'cross-portfolio-intelligence-history.json'),
    reportJsonPath: path.join(dirPath, 'cross-portfolio-intelligence-report.json'),
    reportMarkdownPath: path.join(dirPath, 'cross-portfolio-intelligence-report.md'),
  };
}

export function createCrossPortfolioIntelligenceHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? resolveMissionControlArtifactsRoot());

  function load(input: { crossPortfolioMissionIntelligenceSetId: string }): CrossPortfolioMissionIntelligenceHistory {
    const paths = resolveCrossPortfolioIntelligenceArtifactPaths({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      entries: [],
    });
  }

  function appendEvent(input: {
    crossPortfolioMissionIntelligenceSetId: string;
    eventType: CrossPortfolioIntelligenceHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): { history: CrossPortfolioMissionIntelligenceHistory; appended: boolean; entry: CrossPortfolioMissionIntelligenceHistoryEntry } {
    ensureCrossPortfolioIntelligenceArtifactDir({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      rootDir: artifactsRoot,
    });

    const entry: CrossPortfolioMissionIntelligenceHistoryEntry = {
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      eventType: input.eventType,
      eventDedupeKey: deriveCrossPortfolioIntelligenceHistoryEventDedupeKey(input),
      reasonTokens: uniqueSortedStrings(input.reasonTokens),
      payload: normalizeCanonicalRecord(input.payload),
    };

    const current = load({ crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId });
    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: CrossPortfolioMissionIntelligenceHistory = {
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    const paths = resolveCrossPortfolioIntelligenceArtifactPaths({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function replay(input: { crossPortfolioMissionIntelligenceSetId: string }): CrossPortfolioMissionIntelligenceHistoryEntry[] {
    return [...load(input).entries].sort(compareEntries);
  }

  function write(history: CrossPortfolioMissionIntelligenceHistory): string {
    ensureCrossPortfolioIntelligenceArtifactDir({
      crossPortfolioMissionIntelligenceSetId: history.crossPortfolioMissionIntelligenceSetId,
      rootDir: artifactsRoot,
    });

    const normalized: CrossPortfolioMissionIntelligenceHistory = {
      crossPortfolioMissionIntelligenceSetId: history.crossPortfolioMissionIntelligenceSetId,
      entries: [...history.entries].sort(compareEntries),
    };

    const paths = resolveCrossPortfolioIntelligenceArtifactPaths({
      crossPortfolioMissionIntelligenceSetId: history.crossPortfolioMissionIntelligenceSetId,
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

export type CrossPortfolioIntelligenceHistoryStore = ReturnType<typeof createCrossPortfolioIntelligenceHistoryStore>;
