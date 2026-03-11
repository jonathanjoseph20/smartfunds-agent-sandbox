import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  CrossSwarmHistory,
  CrossSwarmHistoryEntry,
  CrossSwarmHistoryEventType,
  CrossSwarmLifecycleState,
  CrossSwarmReadinessState
} from './cross-swarm-types.ts';

export const DEFAULT_CROSS_SWARM_ARTIFACTS_ROOT = path.join('artifacts', 'cross-swarms');

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

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return [];
  }

  return [...value].sort((left, right) => left.localeCompare(right));
}

function compareEntries(left: CrossSwarmHistoryEntry, right: CrossSwarmHistoryEntry): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): CrossSwarmHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('CROSS_SWARM_INVALID_HISTORY_ENTRY');
  }

  const crossSwarmId = asString(value.crossSwarmId);
  const eventType = asString(value.eventType) as CrossSwarmHistoryEventType;
  const reason = asString(value.reason);
  const eventDedupeKey = asString(value.eventDedupeKey);
  const lifecycleState = asString(value.lifecycleState) as CrossSwarmLifecycleState;
  const readinessState = asString(value.readinessState) as CrossSwarmReadinessState;

  if (!crossSwarmId || !eventType || !reason || !eventDedupeKey || !lifecycleState || !readinessState) {
    throw new Error('CROSS_SWARM_INVALID_HISTORY_ENTRY');
  }

  return {
    crossSwarmId,
    eventType,
    reason,
    eventDedupeKey,
    lifecycleState,
    readinessState,
    completionSatisfied: asBoolean(value.completionSatisfied),
    linkedSwarmIds: asStringArray(value.linkedSwarmIds),
    blockers: asStringArray(value.blockers),
    conflicts: asStringArray(value.conflicts),
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {})
  };
}

function readHistoryFile(filePath: string, fallback: CrossSwarmHistory): CrossSwarmHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('CROSS_SWARM_INVALID_HISTORY');
  }

  const crossSwarmId = asString(parsed.crossSwarmId);
  if (!crossSwarmId) {
    throw new Error('CROSS_SWARM_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    crossSwarmId,
    entries
  };
}

export function resolveCrossSwarmArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_CROSS_SWARM_ARTIFACTS_ROOT);
}

export function resolveCrossSwarmArtifactDir(input: { crossSwarmId: string; rootDir?: string }): string {
  const crossSwarmId = normalizeRelativeSegment(input.crossSwarmId, 'cross_swarm_id');
  return path.join(resolveCrossSwarmArtifactsRoot(input.rootDir), crossSwarmId);
}

export function ensureCrossSwarmArtifactDir(input: { crossSwarmId: string; rootDir?: string }): string {
  const dirPath = resolveCrossSwarmArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveCrossSwarmArtifactPaths(input: { crossSwarmId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveCrossSwarmArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'cross-swarm-status.json'),
    historyJsonPath: path.join(dirPath, 'cross-swarm-history.json'),
    reportJsonPath: path.join(dirPath, 'cross-swarm-report.json'),
    reportMarkdownPath: path.join(dirPath, 'cross-swarm-report.md')
  };
}

export function computeCrossSwarmEventDedupeKey(input: {
  crossSwarmId: string;
  eventType: CrossSwarmHistoryEventType;
  reason: string;
  lifecycleState: CrossSwarmLifecycleState;
  readinessState: CrossSwarmReadinessState;
  completionSatisfied: boolean;
  linkedSwarmIds?: string[];
  blockers?: string[];
  conflicts?: string[];
  slotReference?: string;
}): string {
  return sha256(canonicalStringify({
    crossSwarmId: input.crossSwarmId,
    eventType: input.eventType,
    reason: input.reason,
    lifecycleState: input.lifecycleState,
    readinessState: input.readinessState,
    completionSatisfied: input.completionSatisfied,
    linkedSwarmIds: [...(input.linkedSwarmIds ?? [])].sort((left, right) => left.localeCompare(right)),
    blockers: [...(input.blockers ?? [])].sort((left, right) => left.localeCompare(right)),
    conflicts: [...(input.conflicts ?? [])].sort((left, right) => left.localeCompare(right)),
    slotReference: input.slotReference ?? ''
  }));
}

export function createCrossSwarmHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(crossSwarmId: string): CrossSwarmHistory {
    const paths = resolveCrossSwarmArtifactPaths({
      crossSwarmId,
      rootDir: options.artifactsRoot
    });

    return readHistoryFile(paths.historyJsonPath, {
      crossSwarmId,
      entries: []
    });
  }

  function append(input: {
    crossSwarmId: string;
    eventType: CrossSwarmHistoryEventType;
    reason: string;
    lifecycleState: CrossSwarmLifecycleState;
    readinessState: CrossSwarmReadinessState;
    completionSatisfied: boolean;
    linkedSwarmIds?: string[];
    blockers?: string[];
    conflicts?: string[];
    slotReference?: string;
  }): {
    history: CrossSwarmHistory;
    appended: boolean;
    entry: CrossSwarmHistoryEntry;
  } {
    ensureCrossSwarmArtifactDir({
      crossSwarmId: input.crossSwarmId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveCrossSwarmArtifactPaths({
      crossSwarmId: input.crossSwarmId,
      rootDir: options.artifactsRoot
    });

    const eventDedupeKey = computeCrossSwarmEventDedupeKey(input);
    const entry: CrossSwarmHistoryEntry = {
      crossSwarmId: input.crossSwarmId,
      eventType: input.eventType,
      reason: input.reason,
      eventDedupeKey,
      lifecycleState: input.lifecycleState,
      readinessState: input.readinessState,
      completionSatisfied: input.completionSatisfied,
      linkedSwarmIds: [...(input.linkedSwarmIds ?? [])].sort((left, right) => left.localeCompare(right)),
      blockers: [...(input.blockers ?? [])].sort((left, right) => left.localeCompare(right)),
      conflicts: [...(input.conflicts ?? [])].sort((left, right) => left.localeCompare(right)),
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    };

    const current = load(input.crossSwarmId);
    if (current.entries.some((row) => row.eventDedupeKey === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry
      };
    }

    const next: CrossSwarmHistory = {
      crossSwarmId: input.crossSwarmId,
      entries: [...current.entries, entry].sort(compareEntries)
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry
    };
  }

  function write(history: CrossSwarmHistory): string {
    ensureCrossSwarmArtifactDir({
      crossSwarmId: history.crossSwarmId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveCrossSwarmArtifactPaths({
      crossSwarmId: history.crossSwarmId,
      rootDir: options.artifactsRoot
    });

    const normalized: CrossSwarmHistory = {
      crossSwarmId: history.crossSwarmId,
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

export type CrossSwarmHistoryStore = ReturnType<typeof createCrossSwarmHistoryStore>;
