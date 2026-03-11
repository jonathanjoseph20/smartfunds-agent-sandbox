import {
  createPortfolioHistoryStore,
  resolvePortfolioArtifactPaths,
  type PortfolioHistoryStore,
} from './portfolio-history-store.ts';
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
import type {
  PortfolioIntelligenceProjection,
  PortfolioIntelligenceStatusProjection,
} from './portfolio-types.ts';

function toProjection(input: {
  status: PortfolioIntelligenceStatusProjection;
  historyStore: PortfolioHistoryStore;
  riskAggregator: PortfolioRiskAggregator;
  artifactsRoot?: string;
}): PortfolioIntelligenceProjection {
  const history = input.historyStore.load(input.status.portfolioId);
  const risk = input.riskAggregator.aggregateOne(input.status.portfolioId);

  const statusWithRisk: PortfolioIntelligenceStatusProjection = {
    ...input.status,
    riskThemes: risk.riskThemes,
    exposureFlags: risk.exposureFlags,
    concentrationWarnings: risk.concentrationWarnings,
  };

  const artifactPaths = resolvePortfolioArtifactPaths({
    portfolioId: input.status.portfolioId,
    rootDir: input.artifactsRoot
  });

  const statusPreview = {
    portfolioId: statusWithRisk.portfolioId,
    lifecycleState: statusWithRisk.lifecycleState,
    readinessState: statusWithRisk.readinessState,
    completionState: statusWithRisk.completionState,
    linkedMarketSynthesisIds: statusWithRisk.linkedMarketSynthesisIds,
    blockingReasons: statusWithRisk.blockingReasons,
    strengths: statusWithRisk.strengths,
    limitations: statusWithRisk.limitations,
    riskThemes: statusWithRisk.riskThemes,
    exposureFlags: statusWithRisk.exposureFlags,
    concentrationWarnings: statusWithRisk.concentrationWarnings,
  } as Record<string, unknown>;

  const reportPreview = {
    ...statusWithRisk,
    history,
  } as Record<string, unknown>;

  return {
    ...statusWithRisk,
    displayName: input.status.displayName,
    portfolioType: input.status.portfolioType,
    enabled: input.status.enabled,
    rationale: input.status.rationale,
    linkedMarketSyntheses: input.status.linkedMarketSyntheses,
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

export function createPortfolioProjection(options: {
  registry?: PortfolioRegistry;
  statusProjection?: PortfolioStatusProjectionEngine;
  historyStore?: PortfolioHistoryStore;
  riskAggregator?: PortfolioRiskAggregator;
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
  const registry = options.registry ?? createPortfolioRegistry({
    definitionsDir: options.definitionsDir ?? options.portfolioDefinitionsDir
  });

  const statusProjection = options.statusProjection ?? createPortfolioStatusProjection({
    registry,
    definitionsDir: options.definitionsDir ?? options.portfolioDefinitionsDir,
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

  const riskAggregator = options.riskAggregator ?? createPortfolioRiskAggregator({
    registry,
    definitionsDir: options.definitionsDir ?? options.portfolioDefinitionsDir,
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

  function projectOne(portfolioId: string): PortfolioIntelligenceProjection {
    registry.getPortfolioDefinition(portfolioId);
    const status = statusProjection.projectOne(portfolioId);
    return toProjection({
      status,
      historyStore,
      riskAggregator,
      artifactsRoot: options.portfolioArtifactsRoot,
    });
  }

  function projectAll(): PortfolioIntelligenceProjection[] {
    return registry
      .listPortfolioDefinitions()
      .map((entry) => projectOne(entry.portfolioId))
      .sort((left, right) => left.portfolioId.localeCompare(right.portfolioId));
  }

  return {
    projectOne,
    projectAll,
  };
}

export type PortfolioProjectionEngine = ReturnType<typeof createPortfolioProjection>;
