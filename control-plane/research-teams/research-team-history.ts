import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { ResearchTeamHistory, ResearchTeamHistoryEntry } from './research-team-types.ts';

export const DEFAULT_RESEARCH_TEAM_ARTIFACTS_ROOT = path.join('artifacts', 'research-teams');

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

function compareEntries(left: ResearchTeamHistoryEntry, right: ResearchTeamHistoryEntry): number {
  const leftSlot = left.slotReference ?? '';
  const rightSlot = right.slotReference ?? '';
  const slotCmp = rightSlot.localeCompare(leftSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function parseEntry(value: unknown): ResearchTeamHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('RESEARCH_TEAM_INVALID_HISTORY_ENTRY');
  }

  const teamId = asString(value.teamId);
  const eventType = asString(value.eventType) as ResearchTeamHistoryEntry['eventType'];
  const reason = asString(value.reason);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!teamId || !eventType || !reason || !eventDedupeKey) {
    throw new Error('RESEARCH_TEAM_INVALID_HISTORY_ENTRY');
  }

  return {
    teamId,
    eventType,
    reason,
    eventDedupeKey,
    linkedCohortIds: asStringArray(value.linkedCohortIds),
    linkedInvestigationIds: asStringArray(value.linkedInvestigationIds),
    ...(asString(value.slotReference) ? { slotReference: asString(value.slotReference)! } : {})
  };
}

function readHistoryFile(filePath: string, fallback: ResearchTeamHistory): ResearchTeamHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('RESEARCH_TEAM_INVALID_HISTORY');
  }

  const teamId = asString(parsed.teamId);
  if (!teamId) {
    throw new Error('RESEARCH_TEAM_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    teamId,
    entries
  };
}

export function resolveResearchTeamArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_RESEARCH_TEAM_ARTIFACTS_ROOT);
}

export function resolveResearchTeamArtifactDir(input: { teamId: string; rootDir?: string }): string {
  const teamId = normalizeRelativeSegment(input.teamId, 'team_id');
  return path.join(resolveResearchTeamArtifactsRoot(input.rootDir), teamId);
}

export function ensureResearchTeamArtifactDir(input: { teamId: string; rootDir?: string }): string {
  const dirPath = resolveResearchTeamArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveResearchTeamArtifactPaths(input: { teamId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveResearchTeamArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'team-status.json'),
    historyJsonPath: path.join(dirPath, 'team-history.json'),
    reportMarkdownPath: path.join(dirPath, 'team-report.md')
  };
}

export function computeResearchTeamEventDedupeKey(input: {
  teamId: string;
  eventType: ResearchTeamHistoryEntry['eventType'];
  reason: string;
  linkedCohortIds?: string[];
  linkedInvestigationIds?: string[];
  slotReference?: string;
}): string {
  return sha256(canonicalStringify({
    teamId: input.teamId,
    eventType: input.eventType,
    reason: input.reason,
    linkedCohortIds: [...(input.linkedCohortIds ?? [])].sort((left, right) => left.localeCompare(right)),
    linkedInvestigationIds: [...(input.linkedInvestigationIds ?? [])].sort((left, right) => left.localeCompare(right)),
    slotReference: input.slotReference ?? ''
  }));
}

export function createResearchTeamHistoryStore(options: { artifactsRoot?: string } = {}) {
  function load(teamId: string): ResearchTeamHistory {
    const paths = resolveResearchTeamArtifactPaths({
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
    eventType: ResearchTeamHistoryEntry['eventType'];
    reason: string;
    linkedCohortIds?: string[];
    linkedInvestigationIds?: string[];
    slotReference?: string;
  }): {
    history: ResearchTeamHistory;
    appended: boolean;
    entry: ResearchTeamHistoryEntry;
  } {
    ensureResearchTeamArtifactDir({
      teamId: input.teamId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveResearchTeamArtifactPaths({
      teamId: input.teamId,
      rootDir: options.artifactsRoot
    });

    const eventDedupeKey = computeResearchTeamEventDedupeKey(input);
    const entry: ResearchTeamHistoryEntry = {
      teamId: input.teamId,
      eventType: input.eventType,
      reason: input.reason,
      eventDedupeKey,
      ...(input.linkedCohortIds ? { linkedCohortIds: [...input.linkedCohortIds].sort((left, right) => left.localeCompare(right)) } : {}),
      ...(input.linkedInvestigationIds ? { linkedInvestigationIds: [...input.linkedInvestigationIds].sort((left, right) => left.localeCompare(right)) } : {}),
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

    const next: ResearchTeamHistory = {
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

  function write(history: ResearchTeamHistory): string {
    ensureResearchTeamArtifactDir({
      teamId: history.teamId,
      rootDir: options.artifactsRoot
    });

    const paths = resolveResearchTeamArtifactPaths({
      teamId: history.teamId,
      rootDir: options.artifactsRoot
    });

    const normalized: ResearchTeamHistory = {
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

export type ResearchTeamHistoryStore = ReturnType<typeof createResearchTeamHistoryStore>;
