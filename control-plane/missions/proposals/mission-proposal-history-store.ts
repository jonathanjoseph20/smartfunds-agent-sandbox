import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../../finance/determinism.ts';

import type {
  MissionProposalHistory,
  MissionProposalHistoryEntry,
  MissionProposalHistoryEventType,
} from './mission-proposal-types.ts';

export const DEFAULT_MISSION_PROPOSAL_ARTIFACTS_ROOT = path.join('artifacts', 'mission-proposals');

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

function normalizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

function compareEntries(left: MissionProposalHistoryEntry, right: MissionProposalHistoryEntry): number {
  const eventCmp = left.eventType.localeCompare(right.eventType);
  if (eventCmp !== 0) {
    return eventCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): MissionProposalHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_PROPOSAL_INVALID_HISTORY_ENTRY');
  }

  const proposalId = asString(value.proposalId);
  const eventType = asString(value.eventType) as MissionProposalHistoryEventType;
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!proposalId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('MISSION_PROPOSAL_INVALID_HISTORY_ENTRY');
  }

  return {
    proposalId,
    eventType,
    eventDedupeKey,
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionProposalHistory): MissionProposalHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_PROPOSAL_INVALID_HISTORY');
  }

  const proposalId = asString(parsed.proposalId);
  if (!proposalId) {
    throw new Error('MISSION_PROPOSAL_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    proposalId,
    entries,
  };
}

export function resolveMissionProposalArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_MISSION_PROPOSAL_ARTIFACTS_ROOT);
}

export function resolveMissionProposalArtifactDir(input: { proposalId: string; rootDir?: string }): string {
  const proposalId = normalizeRelativeSegment(input.proposalId, 'proposal_id');
  return path.join(resolveMissionProposalArtifactsRoot(input.rootDir), proposalId);
}

export function ensureMissionProposalArtifactDir(input: { proposalId: string; rootDir?: string }): string {
  const dirPath = resolveMissionProposalArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionProposalArtifactPaths(input: { proposalId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  historyJsonPath: string;
  conversionJsonPath: string;
} {
  const dirPath = resolveMissionProposalArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'proposal-status.json'),
    reportJsonPath: path.join(dirPath, 'proposal-report.json'),
    reportMarkdownPath: path.join(dirPath, 'proposal-report.md'),
    historyJsonPath: path.join(dirPath, 'proposal-history.json'),
    conversionJsonPath: path.join(dirPath, 'proposal-conversion.json'),
  };
}

export function computeMissionProposalEventDedupeKey(input: {
  proposalId: string;
  eventType: MissionProposalHistoryEventType;
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    proposalId: input.proposalId,
    eventType: input.eventType,
    payload: normalizePayload(input.payload),
  }));
}

export function createMissionProposalHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(proposalId: string): MissionProposalHistory {
    const paths = resolveMissionProposalArtifactPaths({
      proposalId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      proposalId,
      entries: [],
    });
  }

  function append(input: {
    proposalId: string;
    eventType: MissionProposalHistoryEventType;
    payload: Record<string, unknown>;
  }): {
    history: MissionProposalHistory;
    appended: boolean;
    entry: MissionProposalHistoryEntry;
  } {
    ensureMissionProposalArtifactDir({
      proposalId: input.proposalId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionProposalArtifactPaths({
      proposalId: input.proposalId,
      rootDir: options.artifactsRoot,
    });

    const eventDedupeKey = computeMissionProposalEventDedupeKey(input);
    const entry: MissionProposalHistoryEntry = {
      proposalId: input.proposalId,
      eventType: input.eventType,
      eventDedupeKey,
      payload: normalizePayload(input.payload),
    };

    const current = load(input.proposalId);
    if (current.entries.some((row) => row.eventDedupeKey === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionProposalHistory = {
      proposalId: input.proposalId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function write(history: MissionProposalHistory): string {
    ensureMissionProposalArtifactDir({
      proposalId: history.proposalId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionProposalArtifactPaths({
      proposalId: history.proposalId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionProposalHistory = {
      proposalId: history.proposalId,
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

export type MissionProposalHistoryStore = ReturnType<typeof createMissionProposalHistoryStore>;
