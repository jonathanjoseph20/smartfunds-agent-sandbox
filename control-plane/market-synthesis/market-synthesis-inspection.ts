import {
  createMarketSynthesisHistoryStore,
  type MarketSynthesisHistoryStore,
} from './market-synthesis-history-store.ts';
import {
  createMarketSynthesisLinker,
  type MarketSynthesisLinker,
} from './market-synthesis-linker.ts';
import {
  createMarketSynthesisMaterializer,
  type MarketSynthesisMaterializer,
} from './market-synthesis-materializer.ts';
import {
  createMarketSynthesisProjection,
  type MarketSynthesisProjectionEngine,
} from './market-synthesis-projection.ts';
import {
  createMarketSynthesisRegistry,
  type MarketSynthesisRegistry,
} from './market-synthesis-registry.ts';
import {
  createMarketSynthesisStatusProjection,
  type MarketSynthesisStatusProjectionEngine,
} from './market-synthesis-status.ts';

function toReadinessReason(readinessState: string, blockers: string[]): string {
  if (readinessState === 'blocked') {
    return blockers.join('|') || 'market_readiness_blocked';
  }
  if (readinessState === 'coherent') {
    return 'market_readiness_coherent';
  }
  if (readinessState === 'analyzing') {
    return 'market_readiness_analyzing';
  }
  return 'market_readiness_pending';
}

function toLifecycleReason(lifecycleState: string): string {
  if (lifecycleState === 'progressing') {
    return 'market_lifecycle_progressing';
  }
  if (lifecycleState === 'active') {
    return 'market_lifecycle_active';
  }
  if (lifecycleState === 'initializing') {
    return 'market_lifecycle_initializing';
  }
  return 'market_synthesis_initialized';
}

export function createMarketInspection(options: {
  registry?: MarketSynthesisRegistry;
  linker?: MarketSynthesisLinker;
  statusProjection?: MarketSynthesisStatusProjectionEngine;
  projection?: MarketSynthesisProjectionEngine;
  materializer?: MarketSynthesisMaterializer;
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
  const definitionsDir = options.definitionsDir ?? options.marketSynthesisDefinitionsDir;

  const registry = options.registry ?? createMarketSynthesisRegistry({ definitionsDir });

  const linker = options.linker ?? createMarketSynthesisLinker({
    registry,
    definitionsDir,
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

  const statusProjection = options.statusProjection ?? createMarketSynthesisStatusProjection({
    registry,
    linker,
    definitionsDir,
    now: options.now,
  });

  const historyStore = options.historyStore ?? createMarketSynthesisHistoryStore({
    artifactsRoot: options.marketSynthesisArtifactsRoot
  });

  const projection = options.projection ?? createMarketSynthesisProjection({
    registry,
    statusProjection,
    historyStore,
    definitionsDir,
    now: options.now,
    marketSynthesisArtifactsRoot: options.marketSynthesisArtifactsRoot,
  });

  const materializer = options.materializer ?? createMarketSynthesisMaterializer({
    projection,
    marketSynthesisArtifactsRoot: options.marketSynthesisArtifactsRoot,
    definitionsDir,
    now: options.now,
  });

  function listMarketSyntheses() {
    return registry.listDefinitions().map((entry) => ({
      marketSynthesisId: entry.marketSynthesisId,
      displayName: entry.displayName,
      synthesisType: entry.synthesisType,
      enabled: entry.enabled,
    }));
  }

  function inspectMarketSynthesis(marketSynthesisId: string) {
    return projection.projectOne(marketSynthesisId);
  }

  function getMarketStatus(marketSynthesisId: string) {
    const status = statusProjection.projectOne(marketSynthesisId);
    return {
      marketSynthesisId,
      lifecycleState: status.lifecycleState,
      readinessState: status.readinessState,
      completionState: status.completionState,
      linkedCrossSwarmIds: status.linkedCrossSwarmIds,
      blockingReasons: status.blockingReasons,
      strengths: status.strengths,
      limitations: status.limitations,
    };
  }

  function getMarketLinks(marketSynthesisId: string) {
    const link = linker.buildLinks().find((entry) => entry.marketSynthesisId === marketSynthesisId);
    if (!link) {
      throw new Error(`MARKET_SYNTHESIS_NOT_FOUND: ${marketSynthesisId}`);
    }

    return {
      marketSynthesisId,
      linkedCrossSwarmIds: link.linkedCrossSwarmIds,
      linkedCrossSwarms: link.linkedCrossSwarms,
      rationale: link.rationale,
    };
  }

  function getMarketReadiness(marketSynthesisId: string) {
    const status = statusProjection.projectOne(marketSynthesisId);
    return {
      marketSynthesisId,
      readinessState: status.readinessState,
      completionState: status.completionState,
      blockingReasons: status.blockingReasons,
      strengths: status.strengths,
      limitations: status.limitations,
    };
  }

  function getMarketHistory(marketSynthesisId: string) {
    registry.getDefinition(marketSynthesisId);
    return historyStore.load(marketSynthesisId);
  }

  function evaluateMarketSynthesis(input: { marketSynthesisId: string; slotReference?: string }) {
    const status = statusProjection.projectOne(input.marketSynthesisId);

    historyStore.append({
      marketSynthesisId: input.marketSynthesisId,
      eventType: 'market_synthesis_initialized',
      reason: 'market_synthesis_projection_generated',
      linkedCrossSwarmIds: status.linkedCrossSwarmIds,
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    });

    if (status.linkedCrossSwarmIds.length > 0) {
      historyStore.append({
        marketSynthesisId: input.marketSynthesisId,
        eventType: 'cross_swarm_linked',
        reason: `linked_cross_swarms:${String(status.linkedCrossSwarmIds.length)}`,
        linkedCrossSwarmIds: status.linkedCrossSwarmIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    historyStore.append({
      marketSynthesisId: input.marketSynthesisId,
      eventType: 'readiness_changed',
      reason: toReadinessReason(status.readinessState, status.blockingReasons),
      linkedCrossSwarmIds: status.linkedCrossSwarmIds,
      ...(input.slotReference ? { slotReference: input.slotReference } : {})
    });

    if (status.lifecycleState === 'initializing' || status.lifecycleState === 'active' || status.lifecycleState === 'progressing') {
      historyStore.append({
        marketSynthesisId: input.marketSynthesisId,
        eventType: 'market_progressed',
        reason: toLifecycleReason(status.lifecycleState),
        linkedCrossSwarmIds: status.linkedCrossSwarmIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    if (status.lifecycleState === 'stabilizing') {
      historyStore.append({
        marketSynthesisId: input.marketSynthesisId,
        eventType: 'market_stabilized',
        reason: status.blockingReasons.join('|') || 'market_stabilizing',
        linkedCrossSwarmIds: status.linkedCrossSwarmIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    if (status.completionState === 'completed') {
      historyStore.append({
        marketSynthesisId: input.marketSynthesisId,
        eventType: 'market_completed',
        reason: 'market_completion_requirements_satisfied',
        linkedCrossSwarmIds: status.linkedCrossSwarmIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    if (status.completionState === 'inconclusive') {
      historyStore.append({
        marketSynthesisId: input.marketSynthesisId,
        eventType: 'market_marked_inconclusive',
        reason: status.limitations.join('|') || 'market_completion_inconclusive',
        linkedCrossSwarmIds: status.linkedCrossSwarmIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {})
      });
    }

    return {
      projection: inspectMarketSynthesis(input.marketSynthesisId),
      history: historyStore.load(input.marketSynthesisId),
    };
  }

  function materializeMarketSynthesis(marketSynthesisId: string) {
    const projected = inspectMarketSynthesis(marketSynthesisId);
    const materialized = materializer.materializeProjection({ projection: projected });
    historyStore.write(historyStore.load(marketSynthesisId));

    return {
      ...materialized,
      historyPath: projected.artifactPaths.historyJsonPath,
    };
  }

  return {
    listMarketSyntheses,
    inspectMarketSynthesis,
    getMarketStatus,
    getMarketLinks,
    getMarketReadiness,
    getMarketHistory,
    evaluateMarketSynthesis,
    materializeMarketSynthesis,
  };
}

export type MarketInspection = ReturnType<typeof createMarketInspection>;
