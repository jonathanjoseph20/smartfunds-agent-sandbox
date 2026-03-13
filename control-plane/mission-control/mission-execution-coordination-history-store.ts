import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  deriveMissionExecutionCoordinationHistoryEventDedupeKey,
  normalizeCanonicalRecord,
  uniqueSortedStrings,
} from './mission-execution-coordination-identity.ts';
import {
  MISSION_EXECUTION_COORDINATION_HISTORY_EVENT_TYPES,
  type MissionExecutionCoordinationHistory,
  type MissionExecutionCoordinationHistoryEntry,
  type MissionExecutionCoordinationHistoryEventType,
} from './mission-execution-coordination-types.ts';
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

function parseEventType(value: unknown): MissionExecutionCoordinationHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return MISSION_EXECUTION_COORDINATION_HISTORY_EVENT_TYPES.includes(parsed as MissionExecutionCoordinationHistoryEventType)
    ? parsed as MissionExecutionCoordinationHistoryEventType
    : null;
}

function parseEntry(value: unknown): MissionExecutionCoordinationHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_EXECUTION_COORDINATION_INVALID_HISTORY_ENTRY');
  }

  const missionExecutionCoordinationPlanId = asString(value.missionExecutionCoordinationPlanId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!missionExecutionCoordinationPlanId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('MISSION_EXECUTION_COORDINATION_INVALID_HISTORY_ENTRY');
  }

  return {
    missionExecutionCoordinationPlanId,
    eventType,
    eventDedupeKey,
    reasonTokens: uniqueSortedStrings(Array.isArray(value.reasonTokens) ? value.reasonTokens.filter((entry): entry is string => typeof entry === 'string') : []),
    payload: normalizeCanonicalRecord(value.payload),
  };
}

function compareEntries(left: MissionExecutionCoordinationHistoryEntry, right: MissionExecutionCoordinationHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function readHistoryFile(filePath: string, fallback: MissionExecutionCoordinationHistory): MissionExecutionCoordinationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_EXECUTION_COORDINATION_INVALID_HISTORY');
  }

  const missionExecutionCoordinationPlanId = asString(parsed.missionExecutionCoordinationPlanId);
  if (!missionExecutionCoordinationPlanId) {
    throw new Error('MISSION_EXECUTION_COORDINATION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    missionExecutionCoordinationPlanId,
    entries,
  };
}

export function resolveMissionExecutionCoordinationArtifactDir(input: { missionExecutionCoordinationPlanId: string; rootDir?: string }): string {
  const missionExecutionCoordinationPlanId = normalizeRelativeSegment(input.missionExecutionCoordinationPlanId, 'mission_execution_coordination_plan_id');
  return path.join(path.resolve(input.rootDir ?? resolveMissionControlArtifactsRoot()), 'execution', missionExecutionCoordinationPlanId);
}

export function ensureMissionExecutionCoordinationArtifactDir(input: { missionExecutionCoordinationPlanId: string; rootDir?: string }): string {
  const dirPath = resolveMissionExecutionCoordinationArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionExecutionCoordinationArtifactPaths(input: { missionExecutionCoordinationPlanId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  intentsJsonPath: string;
  requestsJsonPath: string;
  feedbackLinksJsonPath: string;
  historyJsonPath: string;
  outcomeJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveMissionExecutionCoordinationArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'mission-execution-coordination-status.json'),
    intentsJsonPath: path.join(dirPath, 'mission-execution-intents.json'),
    requestsJsonPath: path.join(dirPath, 'mission-execution-requests.json'),
    feedbackLinksJsonPath: path.join(dirPath, 'mission-execution-feedback-links.json'),
    historyJsonPath: path.join(dirPath, 'mission-execution-coordination-history.json'),
    outcomeJsonPath: path.join(dirPath, 'mission-execution-coordination-outcome.json'),
    reportJsonPath: path.join(dirPath, 'mission-execution-coordination-report.json'),
    reportMarkdownPath: path.join(dirPath, 'mission-execution-coordination-report.md'),
  };
}

export function createMissionExecutionCoordinationHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? resolveMissionControlArtifactsRoot());

  function load(input: { missionExecutionCoordinationPlanId: string }): MissionExecutionCoordinationHistory {
    const paths = resolveMissionExecutionCoordinationArtifactPaths({
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      entries: [],
    });
  }

  function appendEvent(input: {
    missionExecutionCoordinationPlanId: string;
    eventType: MissionExecutionCoordinationHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): { history: MissionExecutionCoordinationHistory; appended: boolean; entry: MissionExecutionCoordinationHistoryEntry } {
    ensureMissionExecutionCoordinationArtifactDir({
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      rootDir: artifactsRoot,
    });

    const entry: MissionExecutionCoordinationHistoryEntry = {
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      eventType: input.eventType,
      eventDedupeKey: deriveMissionExecutionCoordinationHistoryEventDedupeKey(input),
      reasonTokens: uniqueSortedStrings(input.reasonTokens),
      payload: normalizeCanonicalRecord(input.payload),
    };

    const current = load({ missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId });
    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionExecutionCoordinationHistory = {
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    const paths = resolveMissionExecutionCoordinationArtifactPaths({
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function replay(input: { missionExecutionCoordinationPlanId: string }): MissionExecutionCoordinationHistoryEntry[] {
    return [...load(input).entries].sort(compareEntries);
  }

  function write(history: MissionExecutionCoordinationHistory): string {
    ensureMissionExecutionCoordinationArtifactDir({
      missionExecutionCoordinationPlanId: history.missionExecutionCoordinationPlanId,
      rootDir: artifactsRoot,
    });

    const normalized: MissionExecutionCoordinationHistory = {
      missionExecutionCoordinationPlanId: history.missionExecutionCoordinationPlanId,
      entries: [...history.entries].sort(compareEntries),
    };

    const paths = resolveMissionExecutionCoordinationArtifactPaths({
      missionExecutionCoordinationPlanId: history.missionExecutionCoordinationPlanId,
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

export type MissionExecutionCoordinationHistoryStore = ReturnType<typeof createMissionExecutionCoordinationHistoryStore>;
