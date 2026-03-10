import path from 'node:path';

import { createArtifactAccumulator } from './artifact-accumulator.ts';
import { createIntelligenceSynthesizer } from './intelligence-synthesizer.ts';
import { loadMissionPacks } from './mission-packs.ts';
import { loadResearchTeams } from './team-registry.ts';
import type { MissionPack, ResearchTeam } from './types.ts';
import { canonicalStringify } from '../finance/determinism.ts';
import { createSignalEmitter, type SignalEmitter } from '../signals/signal-emitter.ts';
import type { ScheduleLaunchRecord } from '../scheduler/types.ts';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export type ResearchRuntimeOptions = {
  artifactsRoot?: string;
  teamsDir?: string;
  packsDir?: string;
  scheduleRegistryPath?: string;
  signalsRootDir?: string;
  signalEmitter?: SignalEmitter;
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
  const resolvedArtifactsRoot = path.resolve(options.artifactsRoot ?? 'artifacts');
  const defaultSignalsRootDir = path.join(path.dirname(resolvedArtifactsRoot), 'signals');
  const accumulator = createArtifactAccumulator({ artifactsRoot: options.artifactsRoot });
  const synthesizer = createIntelligenceSynthesizer({
    artifactsRoot: options.artifactsRoot,
    accumulator
  });
  const signalEmitter = options.signalEmitter ?? createSignalEmitter({
    signalsRootDir: options.signalsRootDir ?? defaultSignalsRootDir
  });

  function asTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  function asFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  function emitSignalSafe(input: { signalType: string; payload: Record<string, unknown> }): void {
    try {
      signalEmitter.emitSignal(input.signalType, input.payload);
    } catch {
      // Signal bus is passive and must not alter runtime launch processing.
    }
  }

  function emitSignalsForRecord(input: {
    datasetKey: string;
    launch: ScheduleLaunchRecord;
    record: Record<string, unknown>;
  }): void {
    const dataset = input.datasetKey;
    const slot = input.launch.slotId;
    const protocol = asTrimmedString(input.record.protocol);
    const artifactReference = asTrimmedString(input.record.artifactReference) ?? undefined;

    if (dataset === 'protocol_tvl_timeseries' && protocol) {
      const tvlChangePercent = asFiniteNumber(
        input.record.tvlChangePercent
          ?? input.record.deltaPercent
          ?? input.record.changePercent
          ?? input.record.delta24h
      );
      if (tvlChangePercent !== null && tvlChangePercent > 10) {
        emitSignalSafe({
          signalType: 'tvl_spike',
          payload: {
            dataset,
            slot,
            protocol,
            tvlChangePercent,
            ...(artifactReference ? { artifactReference } : {})
          }
        });
      }
      if (tvlChangePercent !== null && tvlChangePercent < -10) {
        emitSignalSafe({
          signalType: 'liquidity_drain',
          payload: {
            dataset,
            slot,
            protocol,
            liquidityDropPercent: Math.abs(tvlChangePercent),
            ...(artifactReference ? { artifactReference } : {})
          }
        });
      }
    }

    if (dataset === 'yield_rate_history' && protocol) {
      const yieldChangePercent = asFiniteNumber(
        input.record.yieldChangePercent
          ?? input.record.changePercent
          ?? input.record.change24h
      );
      if (yieldChangePercent !== null && Math.abs(yieldChangePercent) >= 5) {
        emitSignalSafe({
          signalType: 'yield_anomaly',
          payload: {
            dataset,
            slot,
            protocol,
            yieldChangePercent,
            ...(artifactReference ? { artifactReference } : {})
          }
        });
      }
    }

    if (dataset === 'governance_vote_tracker' && protocol) {
      const proposalId = asTrimmedString(input.record.proposalId ?? input.record.proposal);
      if (proposalId) {
        emitSignalSafe({
          signalType: 'governance_proposal',
          payload: {
            dataset,
            slot,
            protocol,
            proposalId,
            ...(artifactReference ? { artifactReference } : {})
          }
        });
      }

      const riskLevel = asTrimmedString(input.record.riskLevel)
        ?? (asTrimmedString(input.record.riskSignal) ? 'high' : null);
      if (riskLevel) {
        emitSignalSafe({
          signalType: 'protocol_risk',
          payload: {
            dataset,
            slot,
            protocol,
            riskLevel,
            ...(artifactReference ? { artifactReference } : {})
          }
        });
      }
    }

    if (protocol) {
      const unlockAmountUsd = asFiniteNumber(input.record.unlockAmountUsd);
      if (unlockAmountUsd !== null && unlockAmountUsd >= 10_000_000) {
        emitSignalSafe({
          signalType: 'large_token_unlock',
          payload: {
            dataset,
            slot,
            protocol,
            unlockAmountUsd,
            ...(artifactReference ? { artifactReference } : {})
          }
        });
      }
    }
  }

  function emitSignalsForAccumulation(input: {
    launch: ScheduleLaunchRecord;
    updatedDatasets: string[];
    teamId: string;
  }): void {
    for (const datasetKey of input.updatedDatasets.sort((left, right) => left.localeCompare(right))) {
      const dataset = accumulator.readDataset({
        teamId: input.teamId,
        datasetKey
      });

      const relevantRows = dataset.records
        .filter((entry) => entry.scheduleId === input.launch.scheduleId && entry.slotId === input.launch.slotId)
        .map((entry) => entry.data)
        .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
        .sort((left, right) => canonicalStringify(left).localeCompare(canonicalStringify(right)));

      for (const row of relevantRows) {
        emitSignalsForRecord({
          datasetKey,
          launch: input.launch,
          record: row
        });
      }
    }
  }

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

      if (accumulation.processed && accumulation.updatedDatasets.length > 0) {
        emitSignalsForAccumulation({
          launch,
          updatedDatasets: accumulation.updatedDatasets,
          teamId: team.teamId
        });
      }
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
