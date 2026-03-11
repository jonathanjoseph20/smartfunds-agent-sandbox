import {
  createPortfolioLinker,
  type PortfolioLinkResult,
  type PortfolioLinker,
} from './portfolio-linker.ts';
import {
  createPortfolioRegistry,
  type PortfolioRegistry,
} from './portfolio-registry.ts';
import type {
  PortfolioCompletionState,
  PortfolioDefinition,
  PortfolioLifecycleState,
  PortfolioReadinessState,
  PortfolioIntelligenceStatusProjection,
} from './portfolio-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function evaluateLifecycleState(link: PortfolioLinkResult): PortfolioLifecycleState {
  if (link.linkedMarketSyntheses.length === 0) {
    return 'inactive';
  }

  const states = link.linkedMarketSyntheses.map((entry) => entry.lifecycleState);

  if (states.every((state) => state === 'completed')) {
    return 'completed';
  }
  if (states.some((state) => state === 'stabilizing')) {
    return 'stabilizing';
  }
  if (states.some((state) => state === 'progressing')) {
    return 'progressing';
  }
  if (states.some((state) => state === 'active')) {
    return 'active';
  }

  return 'initializing';
}

function buildBlockingReasons(input: {
  definition: PortfolioDefinition;
  link: PortfolioLinkResult;
}): string[] {
  const reasons: string[] = [];

  if (!input.definition.enabled) {
    reasons.push('portfolio_disabled');
  }

  if (input.link.linkedMarketSynthesisIds.length === 0) {
    reasons.push('no_linked_market_syntheses');
  }

  const requireAllReady = input.definition.readinessRules?.requireAllLinkedSynthesesReady === true;

  for (const linked of input.link.linkedMarketSyntheses) {
    if (linked.readinessState === 'blocked') {
      reasons.push(`linked_market_synthesis_blocked:${linked.marketSynthesisId}`);
    }

    if (linked.completionState === 'inconclusive') {
      reasons.push(`linked_market_synthesis_inconclusive:${linked.marketSynthesisId}`);
    }

    if (requireAllReady && linked.readinessState !== 'coherent') {
      reasons.push(`linked_market_synthesis_not_coherent:${linked.marketSynthesisId}`);
    }

    reasons.push(...linked.blockingReasons.map((reason) => `linked_market_synthesis_blocker:${linked.marketSynthesisId}:${reason}`));
  }

  return uniqueSorted(reasons);
}

function evaluateReadinessState(input: {
  definition: PortfolioDefinition;
  link: PortfolioLinkResult;
  blockingReasons: string[];
}): PortfolioReadinessState {
  if (!input.definition.enabled || input.link.linkedMarketSyntheses.length === 0) {
    return 'pending';
  }

  if (input.blockingReasons.length > 0) {
    return 'blocked';
  }

  const states = input.link.linkedMarketSyntheses.map((entry) => entry.readinessState);
  if (states.every((state) => state === 'coherent')) {
    return 'coherent';
  }

  if (states.some((state) => state === 'analyzing' || state === 'coherent')) {
    return 'analyzing';
  }

  return 'pending';
}

function evaluateCompletionState(input: {
  definition: PortfolioDefinition;
  link: PortfolioLinkResult;
  readinessState: PortfolioReadinessState;
  blockingReasons: string[];
}): PortfolioCompletionState {
  if (!input.definition.enabled) {
    return 'incomplete';
  }

  if (input.readinessState === 'blocked' || input.blockingReasons.length > 0) {
    return 'inconclusive';
  }

  if (input.link.linkedMarketSyntheses.some((entry) => entry.completionState === 'inconclusive')) {
    return 'inconclusive';
  }

  const allComplete = input.link.linkedMarketSyntheses.length > 0
    && input.link.linkedMarketSyntheses.every((entry) => entry.completionState === 'completed');

  if (allComplete && input.readinessState === 'coherent') {
    return 'completed';
  }

  return 'incomplete';
}

function buildStrengths(link: PortfolioLinkResult): string[] {
  const strengths: string[] = [];

  if (link.linkedMarketSyntheses.length > 0) {
    strengths.push(`linked_market_syntheses:${String(link.linkedMarketSyntheses.length)}`);
  }

  const coherentCount = link.linkedMarketSyntheses.filter((entry) => entry.readinessState === 'coherent').length;
  if (coherentCount > 0) {
    strengths.push(`coherent_market_syntheses:${String(coherentCount)}`);
  }

  const completedCount = link.linkedMarketSyntheses.filter((entry) => entry.completionState === 'completed').length;
  if (completedCount > 0) {
    strengths.push(`completed_market_syntheses:${String(completedCount)}`);
  }

  return uniqueSorted(strengths);
}

function buildLimitations(input: {
  link: PortfolioLinkResult;
  blockingReasons: string[];
  completionState: PortfolioCompletionState;
}): string[] {
  const limitations: string[] = [...input.blockingReasons];

  if (input.link.linkedMarketSyntheses.some((entry) => entry.lifecycleState !== 'completed')) {
    limitations.push('linked_market_syntheses_still_progressing');
  }

  if (input.completionState === 'inconclusive') {
    limitations.push('completion_inconclusive');
  }

  for (const linked of input.link.linkedMarketSyntheses) {
    limitations.push(...linked.limitations.map((reason) => `linked_market_synthesis_limitation:${linked.marketSynthesisId}:${reason}`));
  }

  return uniqueSorted(limitations);
}

export function createPortfolioStatusProjection(options: {
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

  function projectOne(portfolioId: string): PortfolioIntelligenceStatusProjection {
    const definition = registry.getPortfolioDefinition(portfolioId);
    const link = linker.buildLinks().find((entry) => entry.portfolioId === portfolioId);
    if (!link) {
      throw new Error(`PORTFOLIO_NOT_FOUND: ${portfolioId}`);
    }

    const blockingReasons = buildBlockingReasons({
      definition,
      link,
    });

    const lifecycleState = evaluateLifecycleState(link);
    const readinessState = evaluateReadinessState({
      definition,
      link,
      blockingReasons,
    });

    const completionState = evaluateCompletionState({
      definition,
      link,
      readinessState,
      blockingReasons,
    });

    const strengths = buildStrengths(link);
    const limitations = buildLimitations({
      link,
      blockingReasons,
      completionState,
    });

    return {
      portfolioId,
      displayName: definition.displayName,
      portfolioType: definition.portfolioType,
      enabled: definition.enabled,
      lifecycleState,
      readinessState,
      completionState,
      linkedMarketSynthesisIds: [...link.linkedMarketSynthesisIds].sort((left, right) => left.localeCompare(right)),
      linkedMarketSyntheses: [...link.linkedMarketSyntheses].sort((left, right) => left.marketSynthesisId.localeCompare(right.marketSynthesisId)),
      blockingReasons,
      strengths,
      limitations,
      rationale: [...link.rationale].sort((left, right) => left.localeCompare(right)),
      riskThemes: [],
      exposureFlags: [],
      concentrationWarnings: [],
    };
  }

  function projectAll(): PortfolioIntelligenceStatusProjection[] {
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

export type PortfolioStatusProjectionEngine = ReturnType<typeof createPortfolioStatusProjection>;
