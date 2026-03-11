import {
  createMarketSynthesisHistoryStore,
  resolveMarketSynthesisArtifactPaths,
  type MarketSynthesisHistoryStore,
} from './market-synthesis-history-store.ts';
import {
  createMarketSynthesisRegistry,
  type MarketSynthesisRegistry,
} from './market-synthesis-registry.ts';
import {
  createMarketSynthesisStatusProjection,
  type MarketSynthesisStatusProjectionEngine,
} from './market-synthesis-status.ts';
import type {
  MarketSynthesisProjection,
  MarketSynthesisStatusProjection,
} from './market-synthesis-types.ts';

function toProjection(input: {
  status: MarketSynthesisStatusProjection;
  historyStore: MarketSynthesisHistoryStore;
  artifactsRoot?: string;
}): MarketSynthesisProjection {
  const history = input.historyStore.load(input.status.marketSynthesisId);
  const artifactPaths = resolveMarketSynthesisArtifactPaths({
    marketSynthesisId: input.status.marketSynthesisId,
    rootDir: input.artifactsRoot
  });

  const statusPreview = {
    marketSynthesisId: input.status.marketSynthesisId,
    lifecycleState: input.status.lifecycleState,
    readinessState: input.status.readinessState,
    completionState: input.status.completionState,
    linkedCrossSwarmIds: input.status.linkedCrossSwarmIds,
    blockingReasons: input.status.blockingReasons,
    strengths: input.status.strengths,
    limitations: input.status.limitations,
  } as Record<string, unknown>;

  const reportPreview = {
    ...input.status,
    history,
  } as Record<string, unknown>;

  return {
    ...input.status,
    historySummary: {
      totalEvents: history.entries.length,
      ...(history.entries[0] ? { lastEventType: history.entries[0].eventType } : {}),
      ...(history.entries[0] ? { lastEventDedupeKey: history.entries[0].eventDedupeKey } : {}),
    },
    artifactPaths,
    statusPreview,
    reportPreview,
  };
}

export function createMarketSynthesisProjection(options: {
  registry?: MarketSynthesisRegistry;
  statusProjection?: MarketSynthesisStatusProjectionEngine;
  historyStore?: MarketSynthesisHistoryStore;
  definitionsDir?: string;
  marketSynthesisDefinitionsDir?: string;
  crossSwarmDefinitionsDir?: string;
  swarmDefinitionsDir?: string;
  teamDefinitionsDir?: string;
  cohortDefinitionsDir?: string;
  cohortProgramDefinitionsDir?: string;
  cohortArtifactsRoot?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  policyDefinitionsDir?: string;
  coordinationArtifactsRoot?: string;
  teamSwarmArtifactsRoot?: string;
  swarmArtifactsRoot?: string;
  crossSwarmArtifactsRoot?: string;
  marketSynthesisArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const registry = options.registry ?? createMarketSynthesisRegistry({
    definitionsDir: options.definitionsDir ?? options.marketSynthesisDefinitionsDir
  });

  const statusProjection = options.statusProjection ?? createMarketSynthesisStatusProjection({
    registry,
    definitionsDir: options.definitionsDir ?? options.marketSynthesisDefinitionsDir,
    crossSwarmDefinitionsDir: options.crossSwarmDefinitionsDir,
    swarmDefinitionsDir: options.swarmDefinitionsDir,
    teamDefinitionsDir: options.teamDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    policyDefinitionsDir: options.policyDefinitionsDir,
    coordinationArtifactsRoot: options.coordinationArtifactsRoot,
    teamSwarmArtifactsRoot: options.teamSwarmArtifactsRoot,
    swarmArtifactsRoot: options.swarmArtifactsRoot,
    crossSwarmArtifactsRoot: options.crossSwarmArtifactsRoot,
    now: options.now,
  });

  const historyStore = options.historyStore ?? createMarketSynthesisHistoryStore({
    artifactsRoot: options.marketSynthesisArtifactsRoot
  });

  function projectOne(marketSynthesisId: string): MarketSynthesisProjection {
    registry.getDefinition(marketSynthesisId);
    const status = statusProjection.projectOne(marketSynthesisId);
    return toProjection({
      status,
      historyStore,
      artifactsRoot: options.marketSynthesisArtifactsRoot,
    });
  }

  function projectAll(): MarketSynthesisProjection[] {
    return registry
      .listDefinitions()
      .map((entry) => projectOne(entry.marketSynthesisId))
      .sort((left, right) => left.marketSynthesisId.localeCompare(right.marketSynthesisId));
  }

  return {
    projectOne,
    projectAll,
  };
}

export type MarketSynthesisProjectionEngine = ReturnType<typeof createMarketSynthesisProjection>;
