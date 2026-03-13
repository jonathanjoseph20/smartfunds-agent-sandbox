import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  deriveMissionControlOrchestrationHistoryEventDedupeKey,
  normalizeCanonicalRecord,
  uniqueSortedStrings,
} from './mission-control-orchestration-identity.ts';
import {
  MISSION_CONTROL_ORCHESTRATION_HISTORY_EVENT_TYPES,
  type MissionControlOrchestrationHistory,
  type MissionControlOrchestrationHistoryEntry,
  type MissionControlOrchestrationHistoryEventType,
} from './mission-control-orchestration-types.ts';
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

function parseEventType(value: unknown): MissionControlOrchestrationHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return MISSION_CONTROL_ORCHESTRATION_HISTORY_EVENT_TYPES.includes(parsed as MissionControlOrchestrationHistoryEventType)
    ? parsed as MissionControlOrchestrationHistoryEventType
    : null;
}

function parseEntry(value: unknown): MissionControlOrchestrationHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_CONTROL_ORCHESTRATION_INVALID_HISTORY_ENTRY');
  }

  const missionControlInterventionPlanId = asString(value.missionControlInterventionPlanId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!missionControlInterventionPlanId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('MISSION_CONTROL_ORCHESTRATION_INVALID_HISTORY_ENTRY');
  }

  return {
    missionControlInterventionPlanId,
    eventType,
    eventDedupeKey,
    reasonTokens: uniqueSortedStrings(Array.isArray(value.reasonTokens) ? value.reasonTokens.filter((entry): entry is string => typeof entry === 'string') : []),
    payload: normalizeCanonicalRecord(value.payload),
  };
}

function compareEntries(left: MissionControlOrchestrationHistoryEntry, right: MissionControlOrchestrationHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function readHistoryFile(filePath: string, fallback: MissionControlOrchestrationHistory): MissionControlOrchestrationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_CONTROL_ORCHESTRATION_INVALID_HISTORY');
  }

  const missionControlInterventionPlanId = asString(parsed.missionControlInterventionPlanId);
  if (!missionControlInterventionPlanId) {
    throw new Error('MISSION_CONTROL_ORCHESTRATION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    missionControlInterventionPlanId,
    entries,
  };
}

export function resolveMissionControlOrchestrationArtifactDir(input: { missionControlInterventionPlanId: string; rootDir?: string }): string {
  const missionControlInterventionPlanId = normalizeRelativeSegment(input.missionControlInterventionPlanId, 'mission_control_intervention_plan_id');
  return path.join(path.resolve(input.rootDir ?? resolveMissionControlArtifactsRoot()), 'orchestration', missionControlInterventionPlanId);
}

export function ensureMissionControlOrchestrationArtifactDir(input: { missionControlInterventionPlanId: string; rootDir?: string }): string {
  const dirPath = resolveMissionControlOrchestrationArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionControlOrchestrationArtifactPaths(input: { missionControlInterventionPlanId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  interventionPlanJsonPath: string;
  stabilizationStrategyJsonPath: string;
  actionsJsonPath: string;
  queueJsonPath: string;
  priorityJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveMissionControlOrchestrationArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'mission-control-orchestration-status.json'),
    interventionPlanJsonPath: path.join(dirPath, 'mission-control-intervention-plan.json'),
    stabilizationStrategyJsonPath: path.join(dirPath, 'mission-control-stabilization-strategy.json'),
    actionsJsonPath: path.join(dirPath, 'mission-control-orchestration-actions.json'),
    queueJsonPath: path.join(dirPath, 'mission-control-orchestration-queue.json'),
    priorityJsonPath: path.join(dirPath, 'mission-control-orchestration-priority.json'),
    historyJsonPath: path.join(dirPath, 'mission-control-orchestration-history.json'),
    reportJsonPath: path.join(dirPath, 'mission-control-orchestration-report.json'),
    reportMarkdownPath: path.join(dirPath, 'mission-control-orchestration-report.md'),
  };
}

export function createMissionControlOrchestrationHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? resolveMissionControlArtifactsRoot());

  function load(input: { missionControlInterventionPlanId: string }): MissionControlOrchestrationHistory {
    const paths = resolveMissionControlOrchestrationArtifactPaths({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      entries: [],
    });
  }

  function appendEvent(input: {
    missionControlInterventionPlanId: string;
    eventType: MissionControlOrchestrationHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): { history: MissionControlOrchestrationHistory; appended: boolean; entry: MissionControlOrchestrationHistoryEntry } {
    ensureMissionControlOrchestrationArtifactDir({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      rootDir: artifactsRoot,
    });

    const entry: MissionControlOrchestrationHistoryEntry = {
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      eventType: input.eventType,
      eventDedupeKey: deriveMissionControlOrchestrationHistoryEventDedupeKey(input),
      reasonTokens: uniqueSortedStrings(input.reasonTokens),
      payload: normalizeCanonicalRecord(input.payload),
    };

    const current = load({ missionControlInterventionPlanId: input.missionControlInterventionPlanId });
    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionControlOrchestrationHistory = {
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    const paths = resolveMissionControlOrchestrationArtifactPaths({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry,
    };
  }

  function replay(input: { missionControlInterventionPlanId: string }): MissionControlOrchestrationHistoryEntry[] {
    return [...load(input).entries].sort(compareEntries);
  }

  function write(history: MissionControlOrchestrationHistory): string {
    ensureMissionControlOrchestrationArtifactDir({
      missionControlInterventionPlanId: history.missionControlInterventionPlanId,
      rootDir: artifactsRoot,
    });

    const normalized: MissionControlOrchestrationHistory = {
      missionControlInterventionPlanId: history.missionControlInterventionPlanId,
      entries: [...history.entries].sort(compareEntries),
    };

    const paths = resolveMissionControlOrchestrationArtifactPaths({
      missionControlInterventionPlanId: history.missionControlInterventionPlanId,
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

export type MissionControlOrchestrationHistoryStore = ReturnType<typeof createMissionControlOrchestrationHistoryStore>;
