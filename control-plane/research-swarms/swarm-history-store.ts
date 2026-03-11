import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { SwarmHistory, SwarmHistoryEntry } from './swarm-types.ts';

export const DEFAULT_SWARM_ARTIFACTS_ROOT = path.join('artifacts', 'research-swarms');

function normalizeRelativeSegment(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}: ${value}`);
  }
  return normalized;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareEntries(left: SwarmHistoryEntry, right: SwarmHistoryEntry): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): SwarmHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('SWARM_INVALID_HISTORY_ENTRY');
  }

  const swarmId = asString(value.swarmId);
  const eventType = asString(value.eventType) as SwarmHistoryEntry['eventType'];
  const reason = asString(value.reason);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!swarmId || !eventType || !reason || !eventDedupeKey) {
    throw new Error('SWARM_INVALID_HISTORY_ENTRY');
  }

  return {
    swarmId,
    eventType,
    reason,
    eventDedupeKey,
    linkedInvestigationIds: asStringArray(value.linkedInvestigationIds),
    linkedSynthesisIds: asStringArray(value.linkedSynthesisIds),
    ...(asString(value.state) ? { state: asString(value.state)! as SwarmHistoryEntry['state'] } : {}),
    ...(asString(value.readiness) ? { readiness: asString(value.readiness)! as SwarmHistoryEntry['readiness'] } : {}),
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {})
  };
}

function readHistoryFile(filePath: string, fallback: SwarmHistory): SwarmHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('SWARM_INVALID_HISTORY');
  }

  const swarmId = asString(parsed.swarmId);
  if (!swarmId) {
    throw new Error('SWARM_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    swarmId,
    entries
  };
}

export function resolveSwarmArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_SWARM_ARTIFACTS_ROOT);
}

export function resolveSwarmArtifactDir(input: { swarmId: string; rootDir?: string }): string {
  const swarmId = normalizeRelativeSegment(input.swarmId, 'swarm_id');
  return path.join(resolveSwarmArtifactsRoot(input.rootDir), swarmId);
}

export function ensureSwarmArtifactDir(input: { swarmId: string; rootDir?: string }): string {
  const dirPath = resolveSwarmArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveSwarmArtifactPaths(input: { swarmId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveSwarmArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'swarm-status.json'),
    historyJsonPath: path.join(dirPath, 'swarm-history.json'),
    reportJsonPath: path.join(dirPath, 'swarm-report.json'),
    reportMarkdownPath: path.join(dirPath, 'swarm-report.md')
  };
}

export function computeSwarmEventDedupeKey(input: {
  swarmId: string;
  eventType: SwarmHistoryEntry['eventType'];
  reason: string;
  linkedInvestigationIds?: string[];
  linkedSynthesisIds?: string[];
  state?: SwarmHistoryEntry['state'];
  readiness?: SwarmHistoryEntry['readiness'];
  slotReference?: string;
}): string {
  return sha256(canonicalStringify({
    swarmId: input.swarmId,
    eventType: input.eventType,
    reason: input.reason,
    linkedInvestigationIds: [...(input.linkedInvestigationIds ?? [])].sort((left, right) => left.localeCompare(right)),
    linkedSynthesisIds: [...(input.linkedSynthesisIds ?? [])].sort((left, right) => left.localeCompare(right)),
    state: input.state ?? '',
    readiness: input.readiness ?? '',
    slotReference: input.slotReference ?? ''
  }));
}

export function createSwarmHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(swarmId: string): SwarmHistory {
    const paths = resolveSwarmArtifactPaths({
      swarmId,
      rootDir: options.artifactsRoot
    });

    return readHistoryFile(paths.historyJsonPath, {
      swarmId,
      entries: []
    });
  }

  function append(input: {
    swarmId: string;
    eventType: SwarmHistoryEntry['eventType'];
    reason: string;
    linkedInvestigationIds?: string[];
    linkedSynthesisIds?: string[];
    state?: SwarmHistoryEntry['state'];
    readiness?: SwarmHistoryEntry['readiness'];
    slotReference?: string;
  }): {
    history: SwarmHistory;
    appended: boolean;
    entry: SwarmHistoryEntry;
  } {
    ensureSwarmArtifactDir({
      swarmId: input.swarmId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveSwarmArtifactPaths({
      swarmId: input.swarmId,
      rootDir: options.artifactsRoot
    });

    const eventDedupeKey = computeSwarmEventDedupeKey(input);
    const entry: SwarmHistoryEntry = {
      swarmId: input.swarmId,
      eventType: input.eventType,
      reason: input.reason,
      eventDedupeKey,
      linkedInvestigationIds: [...(input.linkedInvestigationIds ?? [])].sort((left, right) => left.localeCompare(right)),
      linkedSynthesisIds: [...(input.linkedSynthesisIds ?? [])].sort((left, right) => left.localeCompare(right)),
      ...(input.state ? { state: input.state } : {}),
      ...(input.readiness ? { readiness: input.readiness } : {}),
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    };

    const current = load(input.swarmId);
    if (current.entries.some((row) => row.eventDedupeKey === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry
      };
    }

    const next: SwarmHistory = {
      swarmId: input.swarmId,
      entries: [...current.entries, entry].sort(compareEntries)
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry
    };
  }

  function write(history: SwarmHistory): string {
    ensureSwarmArtifactDir({
      swarmId: history.swarmId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveSwarmArtifactPaths({
      swarmId: history.swarmId,
      rootDir: options.artifactsRoot
    });

    const normalized: SwarmHistory = {
      swarmId: history.swarmId,
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

export type SwarmHistoryStore = ReturnType<typeof createSwarmHistoryStore>;
