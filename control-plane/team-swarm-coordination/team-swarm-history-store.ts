import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  TeamSwarmHistory,
  TeamSwarmHistoryEntry,
  TeamSwarmHistoryEventType,
  TeamSwarmLifecycleState,
  TeamSwarmPriority,
  TeamSwarmReadinessState
} from './team-swarm-types.ts';

export const DEFAULT_TEAM_SWARM_ARTIFACTS_ROOT = path.join('artifacts', 'team-swarms');

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

function compareEntries(left: TeamSwarmHistoryEntry, right: TeamSwarmHistoryEntry): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): TeamSwarmHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('TEAM_SWARM_INVALID_HISTORY_ENTRY');
  }

  const teamId = asString(value.teamId);
  const swarmId = asString(value.swarmId);
  const eventType = asString(value.eventType) as TeamSwarmHistoryEventType;
  const reason = asString(value.reason);
  const eventDedupeKey = asString(value.eventDedupeKey);
  const priority = asString(value.priority) as TeamSwarmPriority;
  const lifecycle = asString(value.lifecycle) as TeamSwarmLifecycleState;
  const readiness = asString(value.readiness) as TeamSwarmReadinessState;

  if (!teamId || !swarmId || !eventType || !reason || !eventDedupeKey || !priority || !lifecycle || !readiness) {
    throw new Error('TEAM_SWARM_INVALID_HISTORY_ENTRY');
  }

  return {
    teamId,
    swarmId,
    eventType,
    reason,
    eventDedupeKey,
    priority,
    lifecycle,
    readiness,
    linkedInvestigationIds: asStringArray(value.linkedInvestigationIds),
    linkedSynthesisIds: asStringArray(value.linkedSynthesisIds),
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {})
  };
}

function readHistoryFile(filePath: string, fallback: TeamSwarmHistory): TeamSwarmHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('TEAM_SWARM_INVALID_HISTORY');
  }

  const teamId = asString(parsed.teamId);
  if (!teamId) {
    throw new Error('TEAM_SWARM_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    teamId,
    entries
  };
}

export function resolveTeamSwarmArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_TEAM_SWARM_ARTIFACTS_ROOT);
}

export function resolveTeamSwarmArtifactDir(input: { teamId: string; rootDir?: string }): string {
  const teamId = normalizeRelativeSegment(input.teamId, 'team_id');
  return path.join(resolveTeamSwarmArtifactsRoot(input.rootDir), teamId);
}

export function ensureTeamSwarmArtifactDir(input: { teamId: string; rootDir?: string }): string {
  const dirPath = resolveTeamSwarmArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveTeamSwarmArtifactPaths(input: { teamId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveTeamSwarmArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'team-swarm-status.json'),
    historyJsonPath: path.join(dirPath, 'team-swarm-history.json'),
    reportJsonPath: path.join(dirPath, 'team-swarm-report.json'),
    reportMarkdownPath: path.join(dirPath, 'team-swarm-report.md')
  };
}

export function computeTeamSwarmEventDedupeKey(input: {
  teamId: string;
  swarmId: string;
  eventType: TeamSwarmHistoryEventType;
  reason: string;
  priority: TeamSwarmPriority;
  lifecycle: TeamSwarmLifecycleState;
  readiness: TeamSwarmReadinessState;
  linkedInvestigationIds?: string[];
  linkedSynthesisIds?: string[];
  slotReference?: string;
}): string {
  return sha256(canonicalStringify({
    teamId: input.teamId,
    swarmId: input.swarmId,
    eventType: input.eventType,
    reason: input.reason,
    priority: input.priority,
    lifecycle: input.lifecycle,
    readiness: input.readiness,
    linkedInvestigationIds: [...(input.linkedInvestigationIds ?? [])].sort((left, right) => left.localeCompare(right)),
    linkedSynthesisIds: [...(input.linkedSynthesisIds ?? [])].sort((left, right) => left.localeCompare(right)),
    slotReference: input.slotReference ?? ''
  }));
}

export function createTeamSwarmHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(teamId: string): TeamSwarmHistory {
    const paths = resolveTeamSwarmArtifactPaths({
      teamId,
      rootDir: options.artifactsRoot
    });

    return readHistoryFile(paths.historyJsonPath, {
      teamId,
      entries: []
    });
  }

  function append(input: {
    teamId: string;
    swarmId: string;
    eventType: TeamSwarmHistoryEventType;
    reason: string;
    priority: TeamSwarmPriority;
    lifecycle: TeamSwarmLifecycleState;
    readiness: TeamSwarmReadinessState;
    linkedInvestigationIds?: string[];
    linkedSynthesisIds?: string[];
    slotReference?: string;
  }): {
    history: TeamSwarmHistory;
    appended: boolean;
    entry: TeamSwarmHistoryEntry;
  } {
    ensureTeamSwarmArtifactDir({
      teamId: input.teamId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveTeamSwarmArtifactPaths({
      teamId: input.teamId,
      rootDir: options.artifactsRoot
    });

    const eventDedupeKey = computeTeamSwarmEventDedupeKey(input);
    const entry: TeamSwarmHistoryEntry = {
      teamId: input.teamId,
      swarmId: input.swarmId,
      eventType: input.eventType,
      reason: input.reason,
      eventDedupeKey,
      priority: input.priority,
      lifecycle: input.lifecycle,
      readiness: input.readiness,
      linkedInvestigationIds: [...(input.linkedInvestigationIds ?? [])].sort((left, right) => left.localeCompare(right)),
      linkedSynthesisIds: [...(input.linkedSynthesisIds ?? [])].sort((left, right) => left.localeCompare(right)),
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    };

    const current = load(input.teamId);
    if (current.entries.some((row) => row.eventDedupeKey === eventDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry
      };
    }

    const next: TeamSwarmHistory = {
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

  function write(history: TeamSwarmHistory): string {
    ensureTeamSwarmArtifactDir({
      teamId: history.teamId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveTeamSwarmArtifactPaths({
      teamId: history.teamId,
      rootDir: options.artifactsRoot
    });

    const normalized: TeamSwarmHistory = {
      teamId: history.teamId,
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

export type TeamSwarmHistoryStore = ReturnType<typeof createTeamSwarmHistoryStore>;
