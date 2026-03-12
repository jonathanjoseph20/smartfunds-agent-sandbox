import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionActivationHistory,
  MissionActivationHistoryEntry,
  MissionActivationHistoryEventType,
} from './mission-activation-types.ts';

export const DEFAULT_MISSION_ACTIVATION_ARTIFACTS_ROOT = path.join('artifacts', 'mission-activation');

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

function compareEntries(left: MissionActivationHistoryEntry, right: MissionActivationHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): MissionActivationHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_ACTIVATION_INVALID_HISTORY_ENTRY');
  }

  const activationDecisionId = asString(value.activationDecisionId);
  const missionId = asString(value.missionId);
  const eventType = asString(value.eventType) as MissionActivationHistoryEventType;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reasoning = asString(value.reasoning);

  if (!activationDecisionId || !missionId || !eventType || !eventDedupeKey || !reasoning || !isRecord(value.payload)) {
    throw new Error('MISSION_ACTIVATION_INVALID_HISTORY_ENTRY');
  }

  return {
    activationDecisionId,
    missionId,
    eventType,
    eventDedupeKey,
    reasoning,
    payload: normalizePayload(value.payload),
  };
}

function readHistoryFile(filePath: string, fallback: MissionActivationHistory): MissionActivationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_ACTIVATION_INVALID_HISTORY');
  }

  const activationDecisionId = asString(parsed.activationDecisionId);
  const missionId = asString(parsed.missionId);

  if (!activationDecisionId || !missionId) {
    throw new Error('MISSION_ACTIVATION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    activationDecisionId,
    missionId,
    entries,
  };
}

export function resolveMissionActivationArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_MISSION_ACTIVATION_ARTIFACTS_ROOT);
}

export function resolveMissionActivationArtifactDir(input: { activationDecisionId: string; rootDir?: string }): string {
  const activationDecisionId = normalizeRelativeSegment(input.activationDecisionId, 'activation_decision_id');
  return path.join(resolveMissionActivationArtifactsRoot(input.rootDir), activationDecisionId);
}

export function ensureMissionActivationArtifactDir(input: { activationDecisionId: string; rootDir?: string }): string {
  const dirPath = resolveMissionActivationArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionActivationArtifactPaths(input: { activationDecisionId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  preconditionsJsonPath: string;
  handoffJsonPath: string;
} {
  const dirPath = resolveMissionActivationArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'activation-status.json'),
    historyJsonPath: path.join(dirPath, 'activation-history.json'),
    reportJsonPath: path.join(dirPath, 'activation-report.json'),
    reportMarkdownPath: path.join(dirPath, 'activation-report.md'),
    preconditionsJsonPath: path.join(dirPath, 'activation-preconditions.json'),
    handoffJsonPath: path.join(dirPath, 'activation-handoff.json'),
  };
}

export function computeMissionActivationEventDedupeKey(input: {
  activationDecisionId: string;
  missionId: string;
  eventType: MissionActivationHistoryEventType;
  reasoning: string;
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    activationDecisionId: input.activationDecisionId,
    missionId: input.missionId,
    eventType: input.eventType,
    reasoning: input.reasoning,
    payload: normalizePayload(input.payload),
  }));
}

export function createMissionActivationHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: { activationDecisionId: string; missionId: string }): MissionActivationHistory {
    const paths = resolveMissionActivationArtifactPaths({
      activationDecisionId: input.activationDecisionId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      activationDecisionId: input.activationDecisionId,
      missionId: input.missionId,
      entries: [],
    });
  }

  function append(input: {
    activationDecisionId: string;
    missionId: string;
    eventType: MissionActivationHistoryEventType;
    reasoning: string;
    payload: Record<string, unknown>;
  }): {
    history: MissionActivationHistory;
    appended: boolean;
    entry: MissionActivationHistoryEntry;
  } {
    ensureMissionActivationArtifactDir({
      activationDecisionId: input.activationDecisionId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionActivationArtifactPaths({
      activationDecisionId: input.activationDecisionId,
      rootDir: options.artifactsRoot,
    });

    const entry: MissionActivationHistoryEntry = {
      activationDecisionId: input.activationDecisionId,
      missionId: input.missionId,
      eventType: input.eventType,
      reasoning: input.reasoning,
      payload: normalizePayload(input.payload),
      eventDedupeKey: computeMissionActivationEventDedupeKey(input),
    };

    const current = load({
      activationDecisionId: input.activationDecisionId,
      missionId: input.missionId,
    });

    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionActivationHistory = {
      activationDecisionId: input.activationDecisionId,
      missionId: input.missionId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function write(history: MissionActivationHistory): string {
    ensureMissionActivationArtifactDir({
      activationDecisionId: history.activationDecisionId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionActivationArtifactPaths({
      activationDecisionId: history.activationDecisionId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionActivationHistory = {
      activationDecisionId: history.activationDecisionId,
      missionId: history.missionId,
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

export type MissionActivationHistoryStore = ReturnType<typeof createMissionActivationHistoryStore>;
