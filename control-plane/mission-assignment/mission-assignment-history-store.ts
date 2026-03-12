import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionAssignmentHistory,
  MissionAssignmentHistoryEntry,
  MissionAssignmentHistoryEventType,
  MissionAssignmentFounderOverride,
  MissionAssignmentMissionResolution,
  MissionAssignmentMissionResolutionEntry,
} from './mission-assignment-types.ts';

export const DEFAULT_MISSION_ASSIGNMENT_ARTIFACTS_ROOT = path.join('artifacts', 'mission-assignment');

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

function compareEntries(left: MissionAssignmentHistoryEntry, right: MissionAssignmentHistoryEntry): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function resolutionPriority(entry: MissionAssignmentMissionResolutionEntry): number {
  if (entry.founderOverride.applied) {
    return 2;
  }
  if (entry.resolutionType === 'confirmed') {
    return 1;
  }
  return 0;
}

function normalizeFounderOverride(
  founderOverride: MissionAssignmentFounderOverride,
): MissionAssignmentFounderOverride {
  return JSON.parse(canonicalStringify(founderOverride)) as MissionAssignmentFounderOverride;
}

function parseEntry(value: unknown): MissionAssignmentHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_ASSIGNMENT_INVALID_HISTORY_ENTRY');
  }

  const assignmentDecisionId = asString(value.assignmentDecisionId);
  const missionId = asString(value.missionId);
  const eventType = asString(value.eventType) as MissionAssignmentHistoryEventType;
  const eventDedupeKey = asString(value.eventDedupeKey);
  const reasoning = asString(value.reasoning);

  if (!assignmentDecisionId || !missionId || !eventType || !eventDedupeKey || !reasoning || !isRecord(value.payload)) {
    throw new Error('MISSION_ASSIGNMENT_INVALID_HISTORY_ENTRY');
  }

  return {
    assignmentDecisionId,
    missionId,
    eventType,
    eventDedupeKey,
    reasoning,
    payload: normalizePayload(value.payload),
  };
}

function parseMissionResolutionEntry(value: unknown): MissionAssignmentMissionResolutionEntry {
  if (!isRecord(value)) {
    throw new Error('MISSION_ASSIGNMENT_INVALID_MISSION_RESOLUTION_ENTRY');
  }

  const missionId = asString(value.missionId);
  const assignmentDecisionId = asString(value.assignmentDecisionId);
  const assignmentPolicyId = asString(value.assignmentPolicyId);
  const resolutionType = asString(value.resolutionType) as MissionAssignmentMissionResolutionEntry['resolutionType'];
  const resolutionDedupeKey = asString(value.resolutionDedupeKey);
  const reasoning = asString(value.reasoning);

  if (!missionId || !assignmentDecisionId || !assignmentPolicyId || !resolutionType || !resolutionDedupeKey || !reasoning) {
    throw new Error('MISSION_ASSIGNMENT_INVALID_MISSION_RESOLUTION_ENTRY');
  }

  const founderOverride = isRecord(value.founderOverride)
    ? normalizeFounderOverride(value.founderOverride as MissionAssignmentFounderOverride)
    : { applied: false };

  return {
    missionId,
    assignmentDecisionId,
    assignmentPolicyId,
    ...(asString(value.selectedTeamId) ? { selectedTeamId: asString(value.selectedTeamId)! } : {}),
    founderOverride,
    resolutionType,
    resolutionDedupeKey,
    reasoning,
  };
}

function readHistoryFile(filePath: string, fallback: MissionAssignmentHistory): MissionAssignmentHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_ASSIGNMENT_INVALID_HISTORY');
  }

  const assignmentDecisionId = asString(parsed.assignmentDecisionId);
  const missionId = asString(parsed.missionId);

  if (!assignmentDecisionId || !missionId) {
    throw new Error('MISSION_ASSIGNMENT_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    assignmentDecisionId,
    missionId,
    entries,
  };
}

function readMissionResolutionFile(
  filePath: string,
  fallback: MissionAssignmentMissionResolution,
): MissionAssignmentMissionResolution {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('MISSION_ASSIGNMENT_INVALID_MISSION_RESOLUTION');
  }

  const missionId = asString(parsed.missionId);
  if (!missionId) {
    throw new Error('MISSION_ASSIGNMENT_INVALID_MISSION_RESOLUTION');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseMissionResolutionEntry(entry))
    : [];

  return {
    missionId,
    entries,
  };
}

export function resolveMissionAssignmentArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_MISSION_ASSIGNMENT_ARTIFACTS_ROOT);
}

export function resolveMissionAssignmentArtifactDir(input: { assignmentDecisionId: string; rootDir?: string }): string {
  const assignmentDecisionId = normalizeRelativeSegment(input.assignmentDecisionId, 'assignment_decision_id');
  return path.join(resolveMissionAssignmentArtifactsRoot(input.rootDir), assignmentDecisionId);
}

export function ensureMissionAssignmentArtifactDir(input: { assignmentDecisionId: string; rootDir?: string }): string {
  const dirPath = resolveMissionAssignmentArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveMissionAssignmentArtifactPaths(input: { assignmentDecisionId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  candidatesJsonPath: string;
} {
  const dirPath = resolveMissionAssignmentArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'assignment-status.json'),
    historyJsonPath: path.join(dirPath, 'assignment-history.json'),
    reportJsonPath: path.join(dirPath, 'assignment-report.json'),
    reportMarkdownPath: path.join(dirPath, 'assignment-report.md'),
    candidatesJsonPath: path.join(dirPath, 'assignment-candidates.json'),
  };
}

export function resolveMissionAssignmentMissionResolutionPath(input: { missionId: string; rootDir?: string }): string {
  const missionId = normalizeRelativeSegment(input.missionId, 'mission_id');
  return path.join(resolveMissionAssignmentArtifactsRoot(input.rootDir), 'by-mission', `${missionId}.json`);
}

export function computeMissionAssignmentEventDedupeKey(input: {
  assignmentDecisionId: string;
  missionId: string;
  eventType: MissionAssignmentHistoryEventType;
  reasoning: string;
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    assignmentDecisionId: input.assignmentDecisionId,
    missionId: input.missionId,
    eventType: input.eventType,
    reasoning: input.reasoning,
    payload: normalizePayload(input.payload),
  }));
}

export function computeMissionAssignmentResolutionDedupeKey(input: {
  missionId: string;
  assignmentDecisionId: string;
  assignmentPolicyId: string;
  selectedTeamId?: string;
  founderOverride: MissionAssignmentFounderOverride;
  resolutionType: MissionAssignmentMissionResolutionEntry['resolutionType'];
  reasoning: string;
}): string {
  return sha256(canonicalStringify({
    missionId: input.missionId,
    assignmentDecisionId: input.assignmentDecisionId,
    assignmentPolicyId: input.assignmentPolicyId,
    selectedTeamId: input.selectedTeamId ?? '',
    founderOverride: normalizeFounderOverride(input.founderOverride),
    resolutionType: input.resolutionType,
    reasoning: input.reasoning,
  }));
}

export function createMissionAssignmentHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(input: { assignmentDecisionId: string; missionId: string }): MissionAssignmentHistory {
    const paths = resolveMissionAssignmentArtifactPaths({
      assignmentDecisionId: input.assignmentDecisionId,
      rootDir: options.artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      assignmentDecisionId: input.assignmentDecisionId,
      missionId: input.missionId,
      entries: [],
    });
  }

  function append(input: {
    assignmentDecisionId: string;
    missionId: string;
    eventType: MissionAssignmentHistoryEventType;
    reasoning: string;
    payload: Record<string, unknown>;
  }): {
    history: MissionAssignmentHistory;
    appended: boolean;
    entry: MissionAssignmentHistoryEntry;
  } {
    ensureMissionAssignmentArtifactDir({
      assignmentDecisionId: input.assignmentDecisionId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionAssignmentArtifactPaths({
      assignmentDecisionId: input.assignmentDecisionId,
      rootDir: options.artifactsRoot,
    });

    const entry: MissionAssignmentHistoryEntry = {
      assignmentDecisionId: input.assignmentDecisionId,
      missionId: input.missionId,
      eventType: input.eventType,
      reasoning: input.reasoning,
      payload: normalizePayload(input.payload),
      eventDedupeKey: computeMissionAssignmentEventDedupeKey(input),
    };

    const current = load({
      assignmentDecisionId: input.assignmentDecisionId,
      missionId: input.missionId,
    });

    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry,
      };
    }

    const next: MissionAssignmentHistory = {
      assignmentDecisionId: input.assignmentDecisionId,
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

  function write(history: MissionAssignmentHistory): string {
    ensureMissionAssignmentArtifactDir({
      assignmentDecisionId: history.assignmentDecisionId,
      rootDir: options.artifactsRoot,
    });

    const paths = resolveMissionAssignmentArtifactPaths({
      assignmentDecisionId: history.assignmentDecisionId,
      rootDir: options.artifactsRoot,
    });

    const normalized: MissionAssignmentHistory = {
      assignmentDecisionId: history.assignmentDecisionId,
      missionId: history.missionId,
      entries: [...history.entries].sort(compareEntries),
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  function loadMissionResolution(missionId: string): MissionAssignmentMissionResolution {
    return readMissionResolutionFile(
      resolveMissionAssignmentMissionResolutionPath({
        missionId,
        rootDir: options.artifactsRoot,
      }),
      {
        missionId,
        entries: [],
      },
    );
  }

  function appendMissionResolution(input: {
    missionId: string;
    assignmentDecisionId: string;
    assignmentPolicyId: string;
    selectedTeamId?: string;
    founderOverride: MissionAssignmentFounderOverride;
    resolutionType: MissionAssignmentMissionResolutionEntry['resolutionType'];
    reasoning: string;
  }): {
    resolution: MissionAssignmentMissionResolution;
    appended: boolean;
    entry: MissionAssignmentMissionResolutionEntry;
  } {
    const filePath = resolveMissionAssignmentMissionResolutionPath({
      missionId: input.missionId,
      rootDir: options.artifactsRoot,
    });

    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const entry: MissionAssignmentMissionResolutionEntry = {
      missionId: input.missionId,
      assignmentDecisionId: input.assignmentDecisionId,
      assignmentPolicyId: input.assignmentPolicyId,
      ...(input.selectedTeamId ? { selectedTeamId: input.selectedTeamId } : {}),
      founderOverride: normalizeFounderOverride(input.founderOverride),
      resolutionType: input.resolutionType,
      resolutionDedupeKey: computeMissionAssignmentResolutionDedupeKey(input),
      reasoning: input.reasoning,
    };

    const current = loadMissionResolution(input.missionId);
    if (current.entries.some((row) => row.resolutionDedupeKey === entry.resolutionDedupeKey)) {
      return {
        resolution: current,
        appended: false,
        entry,
      };
    }

    const next: MissionAssignmentMissionResolution = {
      missionId: input.missionId,
      entries: [...current.entries, entry],
    };

    fs.writeFileSync(filePath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      resolution: next,
      appended: true,
      entry,
    };
  }

  function getCurrentMissionResolution(missionId: string): MissionAssignmentMissionResolutionEntry | undefined {
    const resolution = loadMissionResolution(missionId);
    if (resolution.entries.length === 0) {
      return undefined;
    }

    let current = resolution.entries[0];
    for (const entry of resolution.entries.slice(1)) {
      if (resolutionPriority(entry) >= resolutionPriority(current)) {
        current = entry;
      }
    }

    return current;
  }

  return {
    load,
    append,
    write,
    loadMissionResolution,
    appendMissionResolution,
    getCurrentMissionResolution,
  };
}

export type MissionAssignmentHistoryStore = ReturnType<typeof createMissionAssignmentHistoryStore>;
