import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  ActionPlanHistory,
  ActionPlanHistoryEntry,
  ActionPlanHistoryEventType,
} from './action-plan-types.ts';

export const DEFAULT_ACTION_PLAN_ARTIFACTS_ROOT = path.join('artifacts', 'action-orchestration');

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

function dedupeKeyForEntry(entry: ActionPlanHistoryEntry): string {
  return sha256(canonicalStringify({
    actionPlanId: entry.actionPlanId,
    eventType: entry.eventType,
    linkedActionIds: [...(entry.linkedActionIds ?? [])].sort((left, right) => left.localeCompare(right)),
    reason: entry.reason,
    slotReference: entry.slotReference ?? '',
  }));
}

function compareEntries(left: ActionPlanHistoryEntry, right: ActionPlanHistoryEntry): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }

  return dedupeKeyForEntry(left).localeCompare(dedupeKeyForEntry(right));
}

function parseEntry(value: unknown): ActionPlanHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('ACTION_PLAN_INVALID_HISTORY_ENTRY');
  }

  const actionPlanId = asString(value.actionPlanId);
  const eventType = asString(value.eventType) as ActionPlanHistoryEventType;
  const reason = asString(value.reason);

  if (!actionPlanId || !eventType || !reason) {
    throw new Error('ACTION_PLAN_INVALID_HISTORY_ENTRY');
  }

  return {
    actionPlanId,
    eventType,
    reason,
    ...(asStringArray(value.linkedActionIds).length > 0
      ? { linkedActionIds: asStringArray(value.linkedActionIds) }
      : {}),
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {}),
  };
}

function readHistoryFile(filePath: string, fallback: ActionPlanHistory): ActionPlanHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('ACTION_PLAN_INVALID_HISTORY');
  }

  const actionPlanId = asString(parsed.actionPlanId);
  if (!actionPlanId) {
    throw new Error('ACTION_PLAN_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    actionPlanId,
    entries,
  };
}

export function resolveActionPlanArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_ACTION_PLAN_ARTIFACTS_ROOT);
}

export function resolveActionPlanArtifactDir(input: { actionPlanId: string; rootDir?: string }): string {
  const actionPlanId = normalizeRelativeSegment(input.actionPlanId, 'action_plan_id');
  return path.join(resolveActionPlanArtifactsRoot(input.rootDir), actionPlanId);
}

export function ensureActionPlanArtifactDir(input: { actionPlanId: string; rootDir?: string }): string {
  const dirPath = resolveActionPlanArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveActionPlanArtifactPaths(input: { actionPlanId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveActionPlanArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'action-plan-status.json'),
    historyJsonPath: path.join(dirPath, 'action-plan-history.json'),
    reportJsonPath: path.join(dirPath, 'action-plan-report.json'),
    reportMarkdownPath: path.join(dirPath, 'action-plan-report.md'),
  };
}

export function computeActionPlanEventDedupeKey(input: {
  actionPlanId: string;
  eventType: ActionPlanHistoryEventType;
  reason: string;
  linkedActionIds?: string[];
  slotReference?: string;
}): string {
  return sha256(canonicalStringify({
    actionPlanId: input.actionPlanId,
    eventType: input.eventType,
    reason: input.reason,
    linkedActionIds: [...(input.linkedActionIds ?? [])].sort((left, right) => left.localeCompare(right)),
    slotReference: input.slotReference ?? '',
  }));
}

export function createActionPlanHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(actionPlanId: string): ActionPlanHistory {
    const paths = resolveActionPlanArtifactPaths({
      actionPlanId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      actionPlanId,
      entries: [],
    });
  }

  function append(input: {
    actionPlanId: string;
    eventType: ActionPlanHistoryEventType;
    reason: string;
    linkedActionIds?: string[];
    slotReference?: string;
  }): {
    history: ActionPlanHistory;
    appended: boolean;
    entry: ActionPlanHistoryEntry;
  } {
    ensureActionPlanArtifactDir({
      actionPlanId: input.actionPlanId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveActionPlanArtifactPaths({
      actionPlanId: input.actionPlanId,
      rootDir: options.artifactsRoot,
    });

    const entry: ActionPlanHistoryEntry = {
      actionPlanId: input.actionPlanId,
      eventType: input.eventType,
      reason: input.reason,
      ...(input.linkedActionIds && input.linkedActionIds.length > 0
        ? { linkedActionIds: [...input.linkedActionIds].sort((left, right) => left.localeCompare(right)) }
        : {}),
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    };

    const eventDedupeKey = computeActionPlanEventDedupeKey(input);
    const current = load(input.actionPlanId);
    if (current.entries.some((row) => dedupeKeyForEntry(row) === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: ActionPlanHistory = {
      actionPlanId: input.actionPlanId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function write(history: ActionPlanHistory): string {
    ensureActionPlanArtifactDir({
      actionPlanId: history.actionPlanId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveActionPlanArtifactPaths({
      actionPlanId: history.actionPlanId,
      rootDir: options.artifactsRoot,
    });

    const normalized: ActionPlanHistory = {
      actionPlanId: history.actionPlanId,
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

export type ActionPlanHistoryStore = ReturnType<typeof createActionPlanHistoryStore>;
