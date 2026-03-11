import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  PortfolioIntelligenceHistory,
  PortfolioIntelligenceHistoryEntry,
  PortfolioHistoryEventType,
} from './portfolio-types.ts';

export const DEFAULT_PORTFOLIO_ARTIFACTS_ROOT = path.join('artifacts', 'portfolio-intelligence');

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

function compareEntries(left: PortfolioIntelligenceHistoryEntry, right: PortfolioIntelligenceHistoryEntry): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): PortfolioIntelligenceHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('PORTFOLIO_INVALID_HISTORY_ENTRY');
  }

  const portfolioId = asString(value.portfolioId);
  const eventType = asString(value.eventType) as PortfolioHistoryEventType;
  const reason = asString(value.reason);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!portfolioId || !eventType || !reason || !eventDedupeKey) {
    throw new Error('PORTFOLIO_INVALID_HISTORY_ENTRY');
  }

  return {
    portfolioId,
    eventType,
    reason,
    eventDedupeKey,
    linkedMarketSynthesisIds: asStringArray(value.linkedMarketSynthesisIds),
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {})
  };
}

function readHistoryFile(filePath: string, fallback: PortfolioIntelligenceHistory): PortfolioIntelligenceHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('PORTFOLIO_INVALID_HISTORY');
  }

  const portfolioId = asString(parsed.portfolioId);
  if (!portfolioId) {
    throw new Error('PORTFOLIO_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    portfolioId,
    entries,
  };
}

export function resolvePortfolioArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_PORTFOLIO_ARTIFACTS_ROOT);
}

export function resolvePortfolioArtifactDir(input: { portfolioId: string; rootDir?: string }): string {
  const portfolioId = normalizeRelativeSegment(input.portfolioId, 'portfolio_id');
  return path.join(resolvePortfolioArtifactsRoot(input.rootDir), portfolioId);
}

export function ensurePortfolioArtifactDir(input: { portfolioId: string; rootDir?: string }): string {
  const dirPath = resolvePortfolioArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolvePortfolioArtifactPaths(input: { portfolioId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolvePortfolioArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'portfolio-status.json'),
    historyJsonPath: path.join(dirPath, 'portfolio-history.json'),
    reportJsonPath: path.join(dirPath, 'portfolio-report.json'),
    reportMarkdownPath: path.join(dirPath, 'portfolio-report.md'),
  };
}

export function computePortfolioEventDedupeKey(input: {
  portfolioId: string;
  eventType: PortfolioHistoryEventType;
  reason: string;
  linkedMarketSynthesisIds?: string[];
  slotReference?: string;
}): string {
  return sha256(canonicalStringify({
    portfolioId: input.portfolioId,
    eventType: input.eventType,
    reason: input.reason,
    linkedMarketSynthesisIds: [...(input.linkedMarketSynthesisIds ?? [])].sort((left, right) => left.localeCompare(right)),
    slotReference: input.slotReference ?? '',
  }));
}

export function createPortfolioHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(portfolioId: string): PortfolioIntelligenceHistory {
    const paths = resolvePortfolioArtifactPaths({
      portfolioId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      portfolioId,
      entries: [],
    });
  }

  function append(input: {
    portfolioId: string;
    eventType: PortfolioHistoryEventType;
    reason: string;
    linkedMarketSynthesisIds?: string[];
    slotReference?: string;
  }): {
    history: PortfolioIntelligenceHistory;
    appended: boolean;
    entry: PortfolioIntelligenceHistoryEntry;
  } {
    ensurePortfolioArtifactDir({
      portfolioId: input.portfolioId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolvePortfolioArtifactPaths({
      portfolioId: input.portfolioId,
      rootDir: options.artifactsRoot,
    });

    const eventDedupeKey = computePortfolioEventDedupeKey(input);
    const entry: PortfolioIntelligenceHistoryEntry = {
      portfolioId: input.portfolioId,
      eventType: input.eventType,
      reason: input.reason,
      eventDedupeKey,
      linkedMarketSynthesisIds: [...(input.linkedMarketSynthesisIds ?? [])].sort((left, right) => left.localeCompare(right)),
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    };

    const current = load(input.portfolioId);
    if (current.entries.some((row) => row.eventDedupeKey === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: PortfolioIntelligenceHistory = {
      portfolioId: input.portfolioId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function write(history: PortfolioIntelligenceHistory): string {
    ensurePortfolioArtifactDir({
      portfolioId: history.portfolioId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolvePortfolioArtifactPaths({
      portfolioId: history.portfolioId,
      rootDir: options.artifactsRoot,
    });

    const normalized: PortfolioIntelligenceHistory = {
      portfolioId: history.portfolioId,
      entries: [...history.entries].sort(compareEntries)
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

export type PortfolioHistoryStore = ReturnType<typeof createPortfolioHistoryStore>;
