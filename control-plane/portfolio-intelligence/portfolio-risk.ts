import {
  createPortfolioLinker,
  type PortfolioLinker,
} from './portfolio-linker.ts';
import {
  createPortfolioRegistry,
  type PortfolioRegistry,
} from './portfolio-registry.ts';
import type { LinkedMarketSynthesisSummary, PortfolioRiskSurface } from './portfolio-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function hasToken(values: string[], token: string): boolean {
  const normalizedToken = normalizeToken(token);
  return values.some((value) => normalizeToken(value).includes(normalizedToken));
}

function flattenSignals(linked: LinkedMarketSynthesisSummary): string[] {
  return uniqueSorted([
    linked.marketSynthesisId,
    linked.synthesisType,
    ...linked.eventFamilies,
    ...linked.protocolFamilies,
    ...linked.assetFamilies,
    ...linked.blockingReasons,
    ...linked.limitations,
    ...linked.rationale,
  ]);
}

function buildRiskThemes(linkedSyntheses: LinkedMarketSynthesisSummary[]): string[] {
  const themes: string[] = [];

  for (const linked of linkedSyntheses) {
    const signals = flattenSignals(linked);
    if (hasToken(signals, 'governance')) {
      themes.push('governance_risk_rising');
    }
    if (hasToken(signals, 'liquidity')) {
      themes.push('liquidity_stress');
    }
    if (hasToken(signals, 'yield')) {
      themes.push('yield_instability');
    }
    if (linked.protocolFamilies.length > 0) {
      themes.push('protocol_exposure_pressure');
    }
  }

  return uniqueSorted(themes);
}

function buildExposureFlags(linkedSyntheses: LinkedMarketSynthesisSummary[]): string[] {
  const flags: string[] = [];

  for (const linked of linkedSyntheses) {
    if (linked.readinessState === 'blocked') {
      flags.push(`blocked_market_synthesis:${linked.marketSynthesisId}`);
    }
    if (linked.completionState === 'inconclusive') {
      flags.push(`inconclusive_market_synthesis:${linked.marketSynthesisId}`);
    }

    for (const protocolFamily of linked.protocolFamilies) {
      flags.push(`protocol_exposure:${protocolFamily}`);
    }
    for (const assetFamily of linked.assetFamilies) {
      flags.push(`asset_exposure:${assetFamily}`);
    }
    for (const eventFamily of linked.eventFamilies) {
      flags.push(`event_exposure:${eventFamily}`);
    }
  }

  return uniqueSorted(flags);
}

function buildConcentrationWarnings(linkedSyntheses: LinkedMarketSynthesisSummary[]): string[] {
  const warnings: string[] = [];

  if (linkedSyntheses.length === 1) {
    warnings.push('single_synthesis_dependency');
  }

  const protocolCounts = new Map<string, number>();
  const eventCounts = new Map<string, number>();

  for (const linked of linkedSyntheses) {
    for (const protocolFamily of uniqueSorted(linked.protocolFamilies)) {
      protocolCounts.set(protocolFamily, (protocolCounts.get(protocolFamily) ?? 0) + 1);
    }
    for (const eventFamily of uniqueSorted(linked.eventFamilies)) {
      eventCounts.set(eventFamily, (eventCounts.get(eventFamily) ?? 0) + 1);
    }
  }

  for (const [protocolFamily, count] of Array.from(protocolCounts.entries()).sort((left, right) => left[0].localeCompare(right[0]))) {
    if (count > 1) {
      warnings.push(`protocol_concentration:${protocolFamily}:${String(count)}`);
    }
  }

  for (const [eventFamily, count] of Array.from(eventCounts.entries()).sort((left, right) => left[0].localeCompare(right[0]))) {
    if (count > 1) {
      warnings.push(`event_concentration:${eventFamily}:${String(count)}`);
    }
  }

  return uniqueSorted(warnings);
}

export function createPortfolioRiskAggregator(options: {
  registry?: PortfolioRegistry;
  linker?: PortfolioLinker;
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
  now?: () => Date;
} = {}) {
  const registry = options.registry ?? createPortfolioRegistry({
    definitionsDir: options.definitionsDir ?? options.portfolioDefinitionsDir
  });

  const linker = options.linker ?? createPortfolioLinker({
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
    now: options.now
  });

  function aggregateOne(portfolioId: string): PortfolioRiskSurface {
    registry.getPortfolioDefinition(portfolioId);
    const link = linker.buildLinks().find((entry) => entry.portfolioId === portfolioId);
    if (!link) {
      throw new Error(`PORTFOLIO_NOT_FOUND: ${portfolioId}`);
    }

    return {
      portfolioId,
      riskThemes: buildRiskThemes(link.linkedMarketSyntheses),
      exposureFlags: buildExposureFlags(link.linkedMarketSyntheses),
      concentrationWarnings: buildConcentrationWarnings(link.linkedMarketSyntheses),
    };
  }

  function aggregateAll(): PortfolioRiskSurface[] {
    return registry
      .listPortfolioDefinitions()
      .map((entry) => aggregateOne(entry.portfolioId))
      .sort((left, right) => left.portfolioId.localeCompare(right.portfolioId));
  }

  return {
    aggregateOne,
    aggregateAll,
  };
}

export type PortfolioRiskAggregator = ReturnType<typeof createPortfolioRiskAggregator>;
