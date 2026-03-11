import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  PortfolioActionCompletionState,
  PortfolioActionHistory,
  PortfolioActionHistoryEntry,
  PortfolioActionHistoryEventType,
  PortfolioActionPriority,
  PortfolioActionReadinessState,
  PortfolioActionRouteCategory,
} from './portfolio-action-types.ts';

export const DEFAULT_PORTFOLIO_ACTION_ARTIFACTS_ROOT = path.join('artifacts', 'portfolio-actions');

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

function compareEntries(left: PortfolioActionHistoryEntry, right: PortfolioActionHistoryEntry): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): PortfolioActionHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('PORTFOLIO_ACTION_INVALID_HISTORY_ENTRY');
  }

  const actionId = asString(value.actionId);
  const eventType = asString(value.eventType) as PortfolioActionHistoryEventType;
  const reason = asString(value.reason);
  const eventDedupeKey = asString(value.eventDedupeKey);
  const readinessState = asString(value.readinessState) as PortfolioActionReadinessState;
  const completionState = asString(value.completionState) as PortfolioActionCompletionState;
  const priority = asString(value.priority) as PortfolioActionPriority;
  const routeCategory = asString(value.routeCategory) as PortfolioActionRouteCategory;

  if (!actionId || !eventType || !reason || !eventDedupeKey || !readinessState || !completionState || !priority || !routeCategory) {
    throw new Error('PORTFOLIO_ACTION_INVALID_HISTORY_ENTRY');
  }

  return {
    actionId,
    eventType,
    reason,
    eventDedupeKey,
    readinessState,
    completionState,
    priority,
    routeCategory,
    linkedPortfolioIds: asStringArray(value.linkedPortfolioIds),
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {}),
  };
}

function readHistoryFile(filePath: string, fallback: PortfolioActionHistory): PortfolioActionHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('PORTFOLIO_ACTION_INVALID_HISTORY');
  }

  const actionId = asString(parsed.actionId);
  if (!actionId) {
    throw new Error('PORTFOLIO_ACTION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    actionId,
    entries,
  };
}

export function resolvePortfolioActionArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_PORTFOLIO_ACTION_ARTIFACTS_ROOT);
}

export function resolvePortfolioActionArtifactDir(input: { actionId: string; rootDir?: string }): string {
  const actionId = normalizeRelativeSegment(input.actionId, 'action_id');
  return path.join(resolvePortfolioActionArtifactsRoot(input.rootDir), actionId);
}

export function ensurePortfolioActionArtifactDir(input: { actionId: string; rootDir?: string }): string {
  const dirPath = resolvePortfolioActionArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolvePortfolioActionArtifactPaths(input: { actionId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolvePortfolioActionArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'action-status.json'),
    historyJsonPath: path.join(dirPath, 'action-history.json'),
    reportJsonPath: path.join(dirPath, 'action-report.json'),
    reportMarkdownPath: path.join(dirPath, 'action-report.md'),
  };
}

export function computePortfolioActionEventDedupeKey(input: {
  actionId: string;
  eventType: PortfolioActionHistoryEventType;
  reason: string;
  linkedPortfolioIds?: string[];
  readinessState: PortfolioActionReadinessState;
  completionState: PortfolioActionCompletionState;
  priority: PortfolioActionPriority;
  routeCategory: PortfolioActionRouteCategory;
  slotReference?: string;
}): string {
  return sha256(canonicalStringify({
    actionId: input.actionId,
    eventType: input.eventType,
    reason: input.reason,
    linkedPortfolioIds: [...(input.linkedPortfolioIds ?? [])].sort((left, right) => left.localeCompare(right)),
    readinessState: input.readinessState,
    completionState: input.completionState,
    priority: input.priority,
    routeCategory: input.routeCategory,
    slotReference: input.slotReference ?? '',
  }));
}

export function createPortfolioActionHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(actionId: string): PortfolioActionHistory {
    const paths = resolvePortfolioActionArtifactPaths({
      actionId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      actionId,
      entries: [],
    });
  }

  function append(input: {
    actionId: string;
    eventType: PortfolioActionHistoryEventType;
    reason: string;
    linkedPortfolioIds?: string[];
    readinessState: PortfolioActionReadinessState;
    completionState: PortfolioActionCompletionState;
    priority: PortfolioActionPriority;
    routeCategory: PortfolioActionRouteCategory;
    slotReference?: string;
  }): {
    history: PortfolioActionHistory;
    appended: boolean;
    entry: PortfolioActionHistoryEntry;
  } {
    ensurePortfolioActionArtifactDir({
      actionId: input.actionId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolvePortfolioActionArtifactPaths({
      actionId: input.actionId,
      rootDir: options.artifactsRoot,
    });

    const eventDedupeKey = computePortfolioActionEventDedupeKey(input);
    const entry: PortfolioActionHistoryEntry = {
      actionId: input.actionId,
      eventType: input.eventType,
      reason: input.reason,
      linkedPortfolioIds: [...(input.linkedPortfolioIds ?? [])].sort((left, right) => left.localeCompare(right)),
      readinessState: input.readinessState,
      completionState: input.completionState,
      priority: input.priority,
      routeCategory: input.routeCategory,
      eventDedupeKey,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    };

    const current = load(input.actionId);
    if (current.entries.some((row) => row.eventDedupeKey === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: PortfolioActionHistory = {
      actionId: input.actionId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function write(history: PortfolioActionHistory): string {
    ensurePortfolioActionArtifactDir({
      actionId: history.actionId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolvePortfolioActionArtifactPaths({
      actionId: history.actionId,
      rootDir: options.artifactsRoot,
    });

    const normalized: PortfolioActionHistory = {
      actionId: history.actionId,
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

export type PortfolioActionHistoryStore = ReturnType<typeof createPortfolioActionHistoryStore>;
