import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../../finance/determinism.ts';

import type {
  TeamCoordinationEvent,
  TeamCoordinationHistory,
  TeamCoordinationEventType,
  TeamReadinessState,
  TeamResponsePriority,
  TeamStabilizationState
} from './team-coordination-types.ts';

const EVENT_TYPE_ORDER: Record<TeamCoordinationEventType, number> = {
  investigation_routed: 0,
  response_priority_changed: 1,
  response_stabilizing: 2,
  response_resolved: 3
};

export const DEFAULT_RESEARCH_TEAM_ARTIFACTS_ROOT = path.join('artifacts', 'research-teams');

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

function compareEntries(left: TeamCoordinationEvent, right: TeamCoordinationEvent): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }

  const eventCmp = EVENT_TYPE_ORDER[left.eventType] - EVENT_TYPE_ORDER[right.eventType];
  if (eventCmp !== 0) {
    return eventCmp;
  }

  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): TeamCoordinationEvent {
  if (!isRecord(value)) {
    throw new Error('TEAM_COORDINATION_INVALID_HISTORY_ENTRY');
  }

  const eventType = asString(value.eventType) as TeamCoordinationEvent['eventType'];
  const teamId = asString(value.teamId);
  const reason = asString(value.reason);
  const eventDedupeKey = asString(value.eventDedupeKey);
  const priority = asString(value.priority) as TeamResponsePriority;
  const readiness = asString(value.readiness) as TeamReadinessState;
  const stabilizationState = asString(value.stabilizationState) as TeamStabilizationState;

  if (!eventType || !teamId || !reason || !eventDedupeKey || !priority || !readiness || !stabilizationState) {
    throw new Error('TEAM_COORDINATION_INVALID_HISTORY_ENTRY');
  }

  return {
    eventType,
    teamId,
    linkedCohortIds: asStringArray(value.linkedCohortIds),
    linkedInvestigationIds: asStringArray(value.linkedInvestigationIds),
    priority,
    readiness,
    stabilizationState,
    reason,
    eventDedupeKey,
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {}),
    ...(asString(value.routedInvestigationTemplate) ? { routedInvestigationTemplate: asString(value.routedInvestigationTemplate)! } : {}),
    ...(Number.isInteger(value.healthySlotCount) ? { healthySlotCount: Number(value.healthySlotCount) } : {})
  };
}

function readHistoryFile(filePath: string, fallback: TeamCoordinationHistory): TeamCoordinationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('TEAM_COORDINATION_INVALID_HISTORY');
  }

  const teamId = asString(parsed.teamId);
  if (!teamId) {
    throw new Error('TEAM_COORDINATION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    teamId,
    entries
  };
}

export function resolveTeamCoordinationArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_RESEARCH_TEAM_ARTIFACTS_ROOT);
}

export function resolveTeamCoordinationArtifactDir(input: { teamId: string; rootDir?: string }): string {
  const teamId = normalizeRelativeSegment(input.teamId, 'team_id');
  return path.join(resolveTeamCoordinationArtifactsRoot(input.rootDir), teamId);
}

export function ensureTeamCoordinationArtifactDir(input: { teamId: string; rootDir?: string }): string {
  const dirPath = resolveTeamCoordinationArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveTeamCoordinationArtifactPaths(input: { teamId: string; rootDir?: string }): {
  dirPath: string;
  historyJsonPath: string;
} {
  const dirPath = resolveTeamCoordinationArtifactDir(input);
  return {
    dirPath,
    historyJsonPath: path.join(dirPath, 'coordination-history.json')
  };
}

export function computeTeamCoordinationEventDedupeKey(input: Omit<TeamCoordinationEvent, 'eventDedupeKey'>): string {
  return sha256(canonicalStringify({
    eventType: input.eventType,
    teamId: input.teamId,
    linkedCohortIds: [...input.linkedCohortIds].sort((left, right) => left.localeCompare(right)),
    linkedInvestigationIds: [...input.linkedInvestigationIds].sort((left, right) => left.localeCompare(right)),
    priority: input.priority,
    readiness: input.readiness,
    stabilizationState: input.stabilizationState,
    reason: input.reason,
    slotReference: input.slotReference ?? '',
    routedInvestigationTemplate: input.routedInvestigationTemplate ?? '',
    healthySlotCount: input.healthySlotCount ?? -1
  }));
}

export function createTeamCoordinationStore(options: { artifactsRoot?: string } = {}) {
  function load(teamId: string): TeamCoordinationHistory {
    const paths = resolveTeamCoordinationArtifactPaths({
      teamId,
      rootDir: options.artifactsRoot
    });

    return readHistoryFile(paths.historyJsonPath, {
      teamId,
      entries: []
    });
  }

  function append(input: Omit<TeamCoordinationEvent, 'eventDedupeKey'>): {
    history: TeamCoordinationHistory;
    appended: boolean;
    entry: TeamCoordinationEvent;
  } {
    ensureTeamCoordinationArtifactDir({
      teamId: input.teamId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveTeamCoordinationArtifactPaths({
      teamId: input.teamId,
      rootDir: options.artifactsRoot
    });

    const eventDedupeKey = computeTeamCoordinationEventDedupeKey(input);
    const entry: TeamCoordinationEvent = {
      ...input,
      linkedCohortIds: [...input.linkedCohortIds].sort((left, right) => left.localeCompare(right)),
      linkedInvestigationIds: [...input.linkedInvestigationIds].sort((left, right) => left.localeCompare(right)),
      eventDedupeKey
    };

    const current = load(input.teamId);
    if (current.entries.some((row) => row.eventDedupeKey === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry
      };
    }

    const next: TeamCoordinationHistory = {
      teamId: input.teamId,
      entries: [...current.entries, entry].sort(compareEntries)
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry
    };
  }

  return {
    load,
    append
  };
}

export type TeamCoordinationStore = ReturnType<typeof createTeamCoordinationStore>;
