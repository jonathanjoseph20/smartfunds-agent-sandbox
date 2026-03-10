import { createArtifactAccumulator } from './artifact-accumulator.ts';
import { createIntelligenceSynthesizer } from './intelligence-synthesizer.ts';
import { loadMissionPacks } from './mission-packs.ts';
import { loadResearchTeams } from './team-registry.ts';
import type { MissionPack, ResearchTeam } from './types.ts';
import type { ScheduleLaunchRecord } from '../scheduler/types.ts';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export type ResearchRuntimeOptions = {
  artifactsRoot?: string;
  teamsDir?: string;
  packsDir?: string;
  scheduleRegistryPath?: string;
};

export type ProcessedLaunchOutcome = {
  teamId: string;
  packId: string;
  scheduleId: string;
  launchKey: string;
  processed: boolean;
  updatedDatasets: string[];
  summaryGenerated: boolean;
  summaryPaths?: {
    jsonPath: string;
    markdownPath: string;
  };
};

export function createResearchRuntime(options: ResearchRuntimeOptions = {}) {
  const accumulator = createArtifactAccumulator({ artifactsRoot: options.artifactsRoot });
  const synthesizer = createIntelligenceSynthesizer({
    artifactsRoot: options.artifactsRoot,
    accumulator
  });

  function loadContext(): {
    teamById: Map<string, ResearchTeam>;
    packs: MissionPack[];
  } {
    const teams = loadResearchTeams(options.teamsDir).filter((team) => team.enabled !== false);
    const teamById = new Map(teams.map((team) => [team.teamId, team]));
    const packs = loadMissionPacks({
      packsDir: options.packsDir,
      scheduleRegistryPath: options.scheduleRegistryPath
    }).filter((pack) => teamById.has(pack.teamId));

    return {
      teamById,
      packs
    };
  }

  function processLaunch(launch: ScheduleLaunchRecord): ProcessedLaunchOutcome[] {
    const context = loadContext();
    const packMatches = context.packs
      .filter((pack) => pack.schedules.includes(launch.scheduleId))
      .sort((left, right) => left.packId.localeCompare(right.packId));

    const outcomes: ProcessedLaunchOutcome[] = [];

    for (const pack of packMatches) {
      const team = context.teamById.get(pack.teamId);
      if (!team) {
        continue;
      }

      const accumulation = accumulator.accumulateLaunch({
        launch,
        team,
        pack
      });

      let summaryGenerated = false;
      let summaryPaths: { jsonPath: string; markdownPath: string } | undefined;

      if (pack.summaryScheduleId && launch.scheduleId === pack.summaryScheduleId && launch.launched && launch.runId) {
        const synthesis = synthesizer.synthesize({
          team,
          reportDate: synthesizer.reportDateFromSlot(launch.slotId)
        });

        summaryGenerated = true;
        summaryPaths = synthesis.artifacts;
      }

      outcomes.push({
        teamId: team.teamId,
        packId: pack.packId,
        scheduleId: launch.scheduleId,
        launchKey: accumulation.launchKey,
        processed: accumulation.processed,
        updatedDatasets: accumulation.updatedDatasets,
        summaryGenerated,
        ...(summaryPaths ? { summaryPaths } : {})
      });
    }

    return outcomes.sort((left, right) => {
      const teamCmp = left.teamId.localeCompare(right.teamId);
      if (teamCmp !== 0) {
        return teamCmp;
      }
      const packCmp = left.packId.localeCompare(right.packId);
      if (packCmp !== 0) {
        return packCmp;
      }
      return left.scheduleId.localeCompare(right.scheduleId);
    });
  }

  function processLaunches(launches: ScheduleLaunchRecord[]): ProcessedLaunchOutcome[] {
    return launches
      .flatMap((launch) => processLaunch(launch))
      .sort((left, right) => {
        const scheduleCmp = left.scheduleId.localeCompare(right.scheduleId);
        if (scheduleCmp !== 0) {
          return scheduleCmp;
        }
        const launchCmp = left.launchKey.localeCompare(right.launchKey);
        if (launchCmp !== 0) {
          return launchCmp;
        }
        return left.teamId.localeCompare(right.teamId);
      });
  }

  return {
    processLaunch,
    processLaunches
  };
}

export type ResearchRuntime = ReturnType<typeof createResearchRuntime>;
