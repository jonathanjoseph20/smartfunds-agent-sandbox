import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import { deriveMissionReviewHistoryEventDedupeKey } from './mission-review-identity.ts';
import {
  MISSION_REVIEW_HISTORY_EVENT_TYPES,
  type MissionReviewHistory,
  type MissionReviewHistoryEntry,
  type MissionReviewHistoryEventType,
} from './mission-review-types.ts';
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

function parseEventType(value: unknown): MissionReviewHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return MISSION_REVIEW_HISTORY_EVENT_TYPES.includes(parsed as MissionReviewHistoryEventType)
    ? (parsed as MissionReviewHistoryEventType)
    : null;
}

function parseEntry(value: unknown): MissionReviewHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_REVIEW_INVALID_HISTORY_ENTRY');
  }

  const missionRunId = asString(value.missionRunId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!missionRunId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('MISSION_REVIEW_INVALID_HISTORY_ENTRY');
  }

  return {
    missionRunId,
    eventType,
    eventDedupeKey,
    reasonTokens: asStringArray(value.reasonTokens),
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionReviewHistory): MissionReviewHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_REVIEW_INVALID_HISTORY');
  }

  const missionRunId = asString(parsed.missionRunId);
  if (!missionRunId) {
    throw new Error('MISSION_REVIEW_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry))
    : [];

  return {
    missionRunId,
    entries,
  };
}

export function resolveMissionReviewArtifactDir(input: { missionRunId: string; rootDir?: string }): string {
  const missionRunId = normalizeRelativeSegment(input.missionRunId, 'mission_run_id');
  return path.join(path.resolve(input.rootDir ?? resolveMissionControlArtifactsRoot()), missionRunId);
}

export function ensureMissionReviewArtifactDir(input: { missionRunId: string; rootDir?: string }): string {
  const dirPath = resolveMissionReviewArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionReviewArtifactPaths(input: { missionRunId: string; rootDir?: string }): {
  dirPath: string;
  historyJsonPath: string;
  statusJsonPath: string;
  queueJsonPath: string;
  requirementsJsonPath: string;
  decisionHistoryJsonPath: string;
  decisionOutcomeJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveMissionReviewArtifactDir(input);

  return {
    dirPath,
    historyJsonPath: path.join(dirPath, 'mission-review-history.json'),
    statusJsonPath: path.join(dirPath, 'mission-review-status.json'),
    queueJsonPath: path.join(dirPath, 'mission-review-queue.json'),
    requirementsJsonPath: path.join(dirPath, 'mission-review-requirements.json'),
    decisionHistoryJsonPath: path.join(dirPath, 'mission-decision-history.json'),
    decisionOutcomeJsonPath: path.join(dirPath, 'mission-decision-outcome.json'),
    reportJsonPath: path.join(dirPath, 'mission-review-report.json'),
    reportMarkdownPath: path.join(dirPath, 'mission-review-report.md'),
  };
}

export function computeMissionReviewHistoryEventDedupeKey(input: {
  missionRunId: string;
  eventType: MissionReviewHistoryEventType;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  return deriveMissionReviewHistoryEventDedupeKey(input);
}

export function createMissionReviewHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? resolveMissionControlArtifactsRoot());

  function load(input: { missionRunId: string }): MissionReviewHistory {
    const paths = resolveMissionReviewArtifactPaths({
      missionRunId: input.missionRunId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      missionRunId: input.missionRunId,
      entries: [],
    });
  }

  function append(input: {
    missionRunId: string;
    eventType: MissionReviewHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): {
    history: MissionReviewHistory;
    appended: boolean;
    entry: MissionReviewHistoryEntry;
  } {
    ensureMissionReviewArtifactDir({
      missionRunId: input.missionRunId,
      rootDir: artifactsRoot,
    });

    const entry: MissionReviewHistoryEntry = {
      missionRunId: input.missionRunId,
      eventType: input.eventType,
      eventDedupeKey: computeMissionReviewHistoryEventDedupeKey(input),
      reasonTokens: asStringArray(input.reasonTokens ?? []),
      payload: normalizePayload(input.payload),
    };

    const current = load({ missionRunId: input.missionRunId });
    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionReviewHistory = {
      missionRunId: input.missionRunId,
      entries: [...current.entries, entry],
    };

    const paths = resolveMissionReviewArtifactPaths({
      missionRunId: input.missionRunId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function appendReviewEvent(input: {
    missionRunId: string;
    eventType: Extract<MissionReviewHistoryEventType,
      'mission_review_queued'
      | 'mission_review_started'
      | 'mission_review_deferred'
      | 'mission_review_escalated'
      | 'mission_review_closed'>;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }) {
    return append(input);
  }

  function appendDecisionEvent(input: {
    missionRunId: string;
    eventType: Extract<MissionReviewHistoryEventType,
      'mission_decision_recorded'
      | 'mission_approved'
      | 'mission_rejected'
      | 'mission_changes_requested'>;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }) {
    return append(input);
  }

  function replay(input: { missionRunId: string }): MissionReviewHistoryEntry[] {
    return [...load(input).entries];
  }

  function write(history: MissionReviewHistory): string {
    ensureMissionReviewArtifactDir({
      missionRunId: history.missionRunId,
      rootDir: artifactsRoot,
    });

    const normalized: MissionReviewHistory = {
      missionRunId: history.missionRunId,
      entries: [...history.entries],
    };

    const paths = resolveMissionReviewArtifactPaths({
      missionRunId: history.missionRunId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    load,
    append,
    appendReviewEvent,
    appendDecisionEvent,
    replay,
    write,
  };
}

export type MissionReviewHistoryStore = ReturnType<typeof createMissionReviewHistoryStore>;
