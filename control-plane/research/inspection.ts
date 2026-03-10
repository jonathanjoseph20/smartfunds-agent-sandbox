import fs from 'node:fs';
import path from 'node:path';

import { createArtifactAccumulator, type ArtifactAccumulator } from './artifact-accumulator.ts';
import { loadMissionPacks } from './mission-packs.ts';
import { loadResearchTeams } from './team-registry.ts';
import type { MissionPack, ResearchTeam } from './types.ts';

const DEFAULT_ARTIFACTS_ROOT = 'artifacts';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function pickLatestSummary(input: { teamId: string; artifactsRoot: string }): { reportDate: string; jsonPath: string; markdownPath: string } | null {
  const latestPath = path.join(input.artifactsRoot, input.teamId, 'daily-briefs', 'latest-summary.json');
  if (!fs.existsSync(latestPath)) {
    return null;
  }

  const parsed = readJsonFile<Record<string, unknown>>(latestPath, {});
  const reportDate = typeof parsed.reportDate === 'string' ? parsed.reportDate : 'unknown-date';
  const jsonPath = typeof parsed.jsonPath === 'string' ? parsed.jsonPath : '';
  const markdownPath = typeof parsed.markdownPath === 'string' ? parsed.markdownPath : '';

  return {
    reportDate,
    jsonPath,
    markdownPath
  };
}

export function createResearchInspection(input: {
  artifactsRoot?: string;
  accumulator?: ArtifactAccumulator;
  teamsDir?: string;
  packsDir?: string;
  scheduleRegistryPath?: string;
} = {}) {
  const artifactsRoot = input.artifactsRoot ?? DEFAULT_ARTIFACTS_ROOT;
  const accumulator = input.accumulator ?? createArtifactAccumulator({ artifactsRoot });

  function listTeams(): ResearchTeam[] {
    return loadResearchTeams(input.teamsDir);
  }

  function showTeam(teamId: string): ResearchTeam {
    const team = listTeams().find((entry) => entry.teamId === teamId);
    if (!team) {
      throw new Error(`RESEARCH_TEAM_NOT_FOUND: ${teamId}`);
    }
    return team;
  }

  function listPacks(): MissionPack[] {
    return loadMissionPacks({
      packsDir: input.packsDir,
      scheduleRegistryPath: input.scheduleRegistryPath
    });
  }

  function showPack(packId: string): MissionPack {
    const pack = listPacks().find((entry) => entry.packId === packId);
    if (!pack) {
      throw new Error(`MISSION_PACK_NOT_FOUND: ${packId}`);
    }
    return pack;
  }

  function inspectDatasets(teamId: string): Array<{ datasetKey: string; recordCount: number }> {
    return accumulator.listDatasets(teamId)
      .map((datasetKey) => {
        const dataset = accumulator.readDataset({ teamId, datasetKey });
        return {
          datasetKey,
          recordCount: dataset.records.length
        };
      })
      .sort((left, right) => left.datasetKey.localeCompare(right.datasetKey));
  }

  function inspectTeamRuntime(teamId: string): {
    team: ResearchTeam;
    pack: MissionPack;
    datasets: Array<{ datasetKey: string; recordCount: number }>;
    latestSummary: { reportDate: string; jsonPath: string; markdownPath: string } | null;
  } {
    const team = showTeam(teamId);
    const pack = showPack(team.missionPackId);

    return {
      team,
      pack,
      datasets: inspectDatasets(teamId),
      latestSummary: pickLatestSummary({ teamId, artifactsRoot })
    };
  }

  function listTeamArtifactNamespaces(teamId: string): string[] {
    const teamRoot = path.join(artifactsRoot, teamId);
    if (!fs.existsSync(teamRoot)) {
      return [];
    }

    return fs.readdirSync(teamRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((entry) => entry !== '_state' && entry !== 'datasets')
      .sort((left, right) => left.localeCompare(right));
  }

  return {
    listTeams,
    showTeam,
    listPacks,
    showPack,
    inspectDatasets,
    inspectTeamRuntime,
    listTeamArtifactNamespaces
  };
}

export type ResearchInspection = ReturnType<typeof createResearchInspection>;
