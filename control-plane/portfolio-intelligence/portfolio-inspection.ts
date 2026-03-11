import {
  createPortfolioHistoryStore,
  type PortfolioHistoryStore,
} from './portfolio-history-store.ts';
import {
  createPortfolioLinker,
  type PortfolioLinker,
} from './portfolio-linker.ts';
import {
  createPortfolioMaterializer,
  type PortfolioMaterializer,
} from './portfolio-materializer.ts';
import {
  createPortfolioProjection,
  type PortfolioProjectionEngine,
} from './portfolio-projection.ts';
import {
  createPortfolioRegistry,
  type PortfolioRegistry,
} from './portfolio-registry.ts';
import {
  createPortfolioRiskAggregator,
  type PortfolioRiskAggregator,
} from './portfolio-risk.ts';
import {
  createPortfolioStatusProjection,
  type PortfolioStatusProjectionEngine,
} from './portfolio-status.ts';

function toReadinessReason(readinessState: string, blockers: string[]): string {
  if (readinessState === 'blocked') {
    return blockers.join('|') || 'portfolio_readiness_blocked';
  }
  if (readinessState === 'coherent') {
    return 'portfolio_readiness_coherent';
  }
  if (readinessState === 'analyzing') {
    return 'portfolio_readiness_analyzing';
  }
  return 'portfolio_readiness_pending';
}

function toLifecycleReason(lifecycleState: string): string {
  if (lifecycleState === 'progressing') {
    return 'portfolio_lifecycle_progressing';
  }
  if (lifecycleState === 'active') {
    return 'portfolio_lifecycle_active';
  }
  if (lifecycleState === 'initializing') {
    return 'portfolio_lifecycle_initializing';
  }
  return 'portfolio_initialized';
}

export function createPortfolioInspection(options: {
  registry?: PortfolioRegistry;
  linker?: PortfolioLinker;
  statusProjection?: PortfolioStatusProjectionEngine;
  riskAggregator?: PortfolioRiskAggregator;
  projection?: PortfolioProjectionEngine;
  materializer?: PortfolioMaterializer;
  historyStore?: PortfolioHistoryStore;
  definitionsDir?: string;
  portfolioDefinitionsDir?: string;
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
  portfolioArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const definitionsDir = options.definitionsDir ?? options.portfolioDefinitionsDir;

  const registry = options.registry ?? createPortfolioRegistry({ definitionsDir });

  const linker = options.linker ?? createPortfolioLinker({
    registry,
    definitionsDir,
    marketSynthesisDefinitionsDir: options.marketSynthesisDefinitionsDir,
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
    marketSynthesisArtifactsRoot: options.marketSynthesisArtifactsRoot,
    now: options.now,
  });

  const statusProjection = options.statusProjection ?? createPortfolioStatusProjection({
    registry,
    linker,
    definitionsDir,
    marketSynthesisDefinitionsDir: options.marketSynthesisDefinitionsDir,
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
    marketSynthesisArtifactsRoot: options.marketSynthesisArtifactsRoot,
    now: options.now,
  });

  const riskAggregator = options.riskAggregator ?? createPortfolioRiskAggregator({
    registry,
    linker,
    definitionsDir,
    marketSynthesisDefinitionsDir: options.marketSynthesisDefinitionsDir,
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
    marketSynthesisArtifactsRoot: options.marketSynthesisArtifactsRoot,
    now: options.now,
  });

  const historyStore = options.historyStore ?? createPortfolioHistoryStore({
    artifactsRoot: options.portfolioArtifactsRoot,
  });

  const projection = options.projection ?? createPortfolioProjection({
    registry,
    statusProjection,
    riskAggregator,
    historyStore,
    definitionsDir,
    marketSynthesisDefinitionsDir: options.marketSynthesisDefinitionsDir,
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
    marketSynthesisArtifactsRoot: options.marketSynthesisArtifactsRoot,
    portfolioArtifactsRoot: options.portfolioArtifactsRoot,
    now: options.now,
  });

  const materializer = options.materializer ?? createPortfolioMaterializer({
    projection,
    portfolioArtifactsRoot: options.portfolioArtifactsRoot,
    definitionsDir,
    marketSynthesisDefinitionsDir: options.marketSynthesisDefinitionsDir,
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
    marketSynthesisArtifactsRoot: options.marketSynthesisArtifactsRoot,
    now: options.now,
  });

  function listPortfolioIntelligenceUnits() {
    return registry.listPortfolioDefinitions().map((entry) => ({
      portfolioId: entry.portfolioId,
      displayName: entry.displayName,
      portfolioType: entry.portfolioType,
      enabled: entry.enabled,
    }));
  }

  function inspectPortfolioIntelligence(portfolioId: string) {
    return projection.projectOne(portfolioId);
  }

  function getPortfolioStatus(portfolioId: string) {
    const projected = inspectPortfolioIntelligence(portfolioId);
    return {
      portfolioId,
      lifecycleState: projected.lifecycleState,
      readinessState: projected.readinessState,
      completionState: projected.completionState,
      linkedMarketSynthesisIds: projected.linkedMarketSynthesisIds,
      blockingReasons: projected.blockingReasons,
      strengths: projected.strengths,
      limitations: projected.limitations,
      riskThemes: projected.riskThemes,
      exposureFlags: projected.exposureFlags,
      concentrationWarnings: projected.concentrationWarnings,
    };
  }

  function getPortfolioLinks(portfolioId: string) {
    const link = linker.buildLinks().find((entry) => entry.portfolioId === portfolioId);
    if (!link) {
      throw new Error(`PORTFOLIO_NOT_FOUND: ${portfolioId}`);
    }

    return {
      portfolioId,
      linkedMarketSynthesisIds: link.linkedMarketSynthesisIds,
      linkedMarketSyntheses: link.linkedMarketSyntheses,
      rationale: link.rationale,
    };
  }

  function getPortfolioReadiness(portfolioId: string) {
    const projected = inspectPortfolioIntelligence(portfolioId);
    return {
      portfolioId,
      readinessState: projected.readinessState,
      completionState: projected.completionState,
      blockingReasons: projected.blockingReasons,
      strengths: projected.strengths,
      limitations: projected.limitations,
    };
  }

  function getPortfolioRisk(portfolioId: string) {
    registry.getPortfolioDefinition(portfolioId);
    return riskAggregator.aggregateOne(portfolioId);
  }

  function getPortfolioHistory(portfolioId: string) {
    registry.getPortfolioDefinition(portfolioId);
    return historyStore.load(portfolioId);
  }

  function evaluatePortfolioIntelligence(input: { portfolioId: string; slotReference?: string }) {
    const status = statusProjection.projectOne(input.portfolioId);

    historyStore.append({
      portfolioId: input.portfolioId,
      eventType: 'portfolio_initialized',
      reason: 'portfolio_projection_generated',
      linkedMarketSynthesisIds: status.linkedMarketSynthesisIds,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    });

    if (status.linkedMarketSynthesisIds.length > 0) {
      historyStore.append({
        portfolioId: input.portfolioId,
        eventType: 'market_synthesis_linked',
        reason: `linked_market_syntheses:${String(status.linkedMarketSynthesisIds.length)}`,
        linkedMarketSynthesisIds: status.linkedMarketSynthesisIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    historyStore.append({
      portfolioId: input.portfolioId,
      eventType: 'readiness_changed',
      reason: toReadinessReason(status.readinessState, status.blockingReasons),
      linkedMarketSynthesisIds: status.linkedMarketSynthesisIds,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
    });

    if (status.lifecycleState === 'initializing' || status.lifecycleState === 'active' || status.lifecycleState === 'progressing') {
      historyStore.append({
        portfolioId: input.portfolioId,
        eventType: 'portfolio_progressed',
        reason: toLifecycleReason(status.lifecycleState),
        linkedMarketSynthesisIds: status.linkedMarketSynthesisIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    if (status.lifecycleState === 'stabilizing') {
      historyStore.append({
        portfolioId: input.portfolioId,
        eventType: 'portfolio_stabilized',
        reason: status.blockingReasons.join('|') || 'portfolio_stabilizing',
        linkedMarketSynthesisIds: status.linkedMarketSynthesisIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    if (status.completionState === 'completed') {
      historyStore.append({
        portfolioId: input.portfolioId,
        eventType: 'portfolio_completed',
        reason: 'portfolio_completion_requirements_satisfied',
        linkedMarketSynthesisIds: status.linkedMarketSynthesisIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    if (status.completionState === 'inconclusive') {
      historyStore.append({
        portfolioId: input.portfolioId,
        eventType: 'portfolio_marked_inconclusive',
        reason: status.limitations.join('|') || 'portfolio_completion_inconclusive',
        linkedMarketSynthesisIds: status.linkedMarketSynthesisIds,
        ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      });
    }

    return {
      projection: inspectPortfolioIntelligence(input.portfolioId),
      history: historyStore.load(input.portfolioId),
    };
  }

  function materializePortfolioIntelligence(portfolioId: string) {
    const projected = inspectPortfolioIntelligence(portfolioId);
    const materialized = materializer.materializeProjection({ projection: projected });
    historyStore.write(historyStore.load(portfolioId));

    return {
      ...materialized,
      historyPath: projected.artifactPaths.historyJsonPath,
    };
  }

  return {
    listPortfolioIntelligenceUnits,
    inspectPortfolioIntelligence,
    getPortfolioStatus,
    getPortfolioLinks,
    getPortfolioReadiness,
    getPortfolioRisk,
    getPortfolioHistory,
    evaluatePortfolioIntelligence,
    materializePortfolioIntelligence,
  };
}

export type PortfolioInspection = ReturnType<typeof createPortfolioInspection>;
