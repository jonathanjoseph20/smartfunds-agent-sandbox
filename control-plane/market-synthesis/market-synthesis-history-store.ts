import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MarketSynthesisHistory,
  MarketSynthesisHistoryEntry,
  MarketSynthesisHistoryEventType,
} from './market-synthesis-types.ts';

export const DEFAULT_MARKET_SYNTHESIS_ARTIFACTS_ROOT = path.join('artifacts', 'market-synthesis');

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

  return [...value].sort((left, right) => left.localeCompare(right));
}

function compareEntries(left: MarketSynthesisHistoryEntry, right: MarketSynthesisHistoryEntry): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): MarketSynthesisHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MARKET_SYNTHESIS_INVALID_HISTORY_ENTRY');
  }

  const marketSynthesisId = asString(value.marketSynthesisId);
  const eventType = asString(value.eventType) as MarketSynthesisHistoryEventType;
  const reason = asString(value.reason);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!marketSynthesisId || !eventType || !reason || !eventDedupeKey) {
    throw new Error('MARKET_SYNTHESIS_INVALID_HISTORY_ENTRY');
  }

  return {
    marketSynthesisId,
    eventType,
    reason,
    eventDedupeKey,
    linkedCrossSwarmIds: asStringArray(value.linkedCrossSwarmIds),
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {})
  };
}

function readHistoryFile(filePath: string, fallback: MarketSynthesisHistory): MarketSynthesisHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MARKET_SYNTHESIS_INVALID_HISTORY');
  }

  const marketSynthesisId = asString(parsed.marketSynthesisId);
  if (!marketSynthesisId) {
    throw new Error('MARKET_SYNTHESIS_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    marketSynthesisId,
    entries
  };
}

export function resolveMarketSynthesisArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_MARKET_SYNTHESIS_ARTIFACTS_ROOT);
}

export function resolveMarketSynthesisArtifactDir(input: { marketSynthesisId: string; rootDir?: string }): string {
  const marketSynthesisId = normalizeRelativeSegment(input.marketSynthesisId, 'market_synthesis_id');
  return path.join(resolveMarketSynthesisArtifactsRoot(input.rootDir), marketSynthesisId);
}

export function ensureMarketSynthesisArtifactDir(input: { marketSynthesisId: string; rootDir?: string }): string {
  const dirPath = resolveMarketSynthesisArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMarketSynthesisArtifactPaths(input: { marketSynthesisId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveMarketSynthesisArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'market-synthesis-status.json'),
    historyJsonPath: path.join(dirPath, 'market-synthesis-history.json'),
    reportJsonPath: path.join(dirPath, 'market-synthesis-report.json'),
    reportMarkdownPath: path.join(dirPath, 'market-synthesis-report.md')
  };
}

export function computeMarketSynthesisEventDedupeKey(input: {
  marketSynthesisId: string;
  eventType: MarketSynthesisHistoryEventType;
  reason: string;
  linkedCrossSwarmIds?: string[];
  slotReference?: string;
}): string {
  return sha256(canonicalStringify({
    marketSynthesisId: input.marketSynthesisId,
    eventType: input.eventType,
    reason: input.reason,
    linkedCrossSwarmIds: [...(input.linkedCrossSwarmIds ?? [])].sort((left, right) => left.localeCompare(right)),
    slotReference: input.slotReference ?? ''
  }));
}

export function createMarketSynthesisHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(marketSynthesisId: string): MarketSynthesisHistory {
    const paths = resolveMarketSynthesisArtifactPaths({
      marketSynthesisId,
      rootDir: options.artifactsRoot
    });

    return readHistoryFile(paths.historyJsonPath, {
      marketSynthesisId,
      entries: []
    });
  }

  function append(input: {
    marketSynthesisId: string;
    eventType: MarketSynthesisHistoryEventType;
    reason: string;
    linkedCrossSwarmIds?: string[];
    slotReference?: string;
  }): {
    history: MarketSynthesisHistory;
    appended: boolean;
    entry: MarketSynthesisHistoryEntry;
  } {
    ensureMarketSynthesisArtifactDir({
      marketSynthesisId: input.marketSynthesisId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveMarketSynthesisArtifactPaths({
      marketSynthesisId: input.marketSynthesisId,
      rootDir: options.artifactsRoot
    });

    const eventDedupeKey = computeMarketSynthesisEventDedupeKey(input);
    const entry: MarketSynthesisHistoryEntry = {
      marketSynthesisId: input.marketSynthesisId,
      eventType: input.eventType,
      reason: input.reason,
      eventDedupeKey,
      linkedCrossSwarmIds: [...(input.linkedCrossSwarmIds ?? [])].sort((left, right) => left.localeCompare(right)),
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    };

    const current = load(input.marketSynthesisId);
    if (current.entries.some((row) => row.eventDedupeKey === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MarketSynthesisHistory = {
      marketSynthesisId: input.marketSynthesisId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function write(history: MarketSynthesisHistory): string {
    ensureMarketSynthesisArtifactDir({
      marketSynthesisId: history.marketSynthesisId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveMarketSynthesisArtifactPaths({
      marketSynthesisId: history.marketSynthesisId,
      rootDir: options.artifactsRoot
    });

    const normalized: MarketSynthesisHistory = {
      marketSynthesisId: history.marketSynthesisId,
      entries: [...history.entries].sort(compareEntries)
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    load,
    append,
    write
  };
}

export type MarketSynthesisHistoryStore = ReturnType<typeof createMarketSynthesisHistoryStore>;
