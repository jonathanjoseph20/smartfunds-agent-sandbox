import fs from 'node:fs';
import path from 'node:path';

import type { ResearchTeam } from './types.ts';

export const DEFAULT_RESEARCH_TEAMS_DIR = 'control-plane/research/teams';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseResearchTeam(value: unknown, sourceLabel: string): ResearchTeam {
  if (!isRecord(value)) {
    throw new Error(`Research team definition ${sourceLabel} must be an object.`);
  }

  const teamId = asTrimmedString(value.teamId);
  const missionPackId = asTrimmedString(value.missionPackId);
  const description = asTrimmedString(value.description);

  if (!teamId) {
    throw new Error(`Research team definition ${sourceLabel} teamId must be a non-empty string.`);
  }
  if (!missionPackId) {
    throw new Error(`Research team ${teamId} missionPackId must be a non-empty string.`);
  }
  if (!description) {
    throw new Error(`Research team ${teamId} description must be a non-empty string.`);
  }

  const datasetKeysValue = value.datasetKeys;
  let datasetKeys: string[] | undefined;
  if (datasetKeysValue !== undefined) {
    if (!Array.isArray(datasetKeysValue) || !datasetKeysValue.every((entry) => asTrimmedString(entry))) {
      throw new Error(`Research team ${teamId} datasetKeys must be an array of non-empty strings.`);
    }
    datasetKeys = sortedUnique(datasetKeysValue.map((entry) => String(entry).trim()));
  }

  const summaryArtifactPath = value.summaryArtifactPath === undefined ? undefined : asTrimmedString(value.summaryArtifactPath);
  if (value.summaryArtifactPath !== undefined && !summaryArtifactPath) {
    throw new Error(`Research team ${teamId} summaryArtifactPath must be a non-empty string when provided.`);
  }

  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
    throw new Error(`Research team ${teamId} enabled must be a boolean when provided.`);
  }

  const displayName = value.displayName === undefined ? undefined : asTrimmedString(value.displayName);
  if (value.displayName !== undefined && !displayName) {
    throw new Error(`Research team ${teamId} displayName must be a non-empty string when provided.`);
  }

  return {
    teamId,
    missionPackId,
    description,
    ...(displayName ? { displayName } : {}),
    ...(datasetKeys ? { datasetKeys } : {}),
    ...(summaryArtifactPath ? { summaryArtifactPath } : {}),
    ...(typeof value.enabled === 'boolean' ? { enabled: value.enabled } : {})
  };
}

function loadJsonFiles(dir: string): Array<{ filePath: string; parsed: unknown }> {
  const resolvedDir = path.resolve(dir);
  if (!fs.existsSync(resolvedDir)) {
    return [];
  }

  return fs.readdirSync(resolvedDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((entry) => {
      const filePath = path.join(resolvedDir, entry);
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return { filePath, parsed };
    });
}

export function validateResearchTeams(teams: ResearchTeam[]): ResearchTeam[] {
  const seen = new Set<string>();

  const normalized = teams.map((team) => {
    if (seen.has(team.teamId)) {
      throw new Error(`Duplicate research teamId detected: ${team.teamId}`);
    }
    seen.add(team.teamId);

    return {
      ...team,
      ...(team.datasetKeys ? { datasetKeys: sortedUnique(team.datasetKeys) } : {})
    };
  });

  return [...normalized].sort((left, right) => left.teamId.localeCompare(right.teamId));
}

export function loadResearchTeams(dir: string = DEFAULT_RESEARCH_TEAMS_DIR): ResearchTeam[] {
  const files = loadJsonFiles(dir);
  const teams = files.map((entry) => parseResearchTeam(entry.parsed, path.basename(entry.filePath)));
  return validateResearchTeams(teams);
}

export function getResearchTeamById(teamId: string, dir: string = DEFAULT_RESEARCH_TEAMS_DIR): ResearchTeam {
  const team = loadResearchTeams(dir).find((entry) => entry.teamId === teamId);
  if (!team) {
    throw new Error(`RESEARCH_TEAM_NOT_FOUND: ${teamId}`);
  }
  return team;
}
