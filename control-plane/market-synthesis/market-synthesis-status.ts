import {
  createMarketSynthesisLinker,
  type MarketSynthesisLinkProjection,
  type MarketSynthesisLinker
} from './market-synthesis-linker.ts';
import {
  createMarketSynthesisRegistry,
  type MarketSynthesisRegistry,
} from './market-synthesis-registry.ts';
import type {
  MarketSynthesisCompletionState,
  MarketSynthesisLifecycleState,
  MarketSynthesisReadinessState,
  MarketSynthesisStatusProjection,
} from './market-synthesis-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function evaluateLifecycleState(link: MarketSynthesisLinkProjection): MarketSynthesisLifecycleState {
  if (!link.enabled || link.linkedCrossSwarms.length === 0) {
    return 'inactive';
  }

  const states = link.linkedCrossSwarms.map((entry) => entry.lifecycleState);

  if (states.every((state) => state === 'inactive')) {
    return 'inactive';
  }
  if (states.every((state) => state === 'initializing' || state === 'inactive')) {
    return 'initializing';
  }
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
  link: MarketSynthesisLinkProjection;
  minCrossSwarms: number;
}): { blockingReasons: string[]; contradictions: string[]; weakCoverage: boolean } {
  const reasons: string[] = [];

  if (!input.link.enabled) {
    reasons.push('market_synthesis_disabled');
  }
  if (input.link.linkedCrossSwarmIds.length === 0) {
    reasons.push('no_linked_cross_swarms');
  }

  const weakCoverage = input.link.linkedCrossSwarmIds.length < input.minCrossSwarms;
  if (weakCoverage) {
    reasons.push(
      `weak_coverage:min_required:${String(input.minCrossSwarms)}:linked:${String(input.link.linkedCrossSwarmIds.length)}`
    );
  }

  for (const crossSwarm of input.link.linkedCrossSwarms) {
    if (crossSwarm.readinessState === 'blocked') {
      reasons.push(`linked_cross_swarm_blocked:${crossSwarm.crossSwarmId}`);
    }
    if (crossSwarm.unresolvedConflictCount > 0) {
      reasons.push(`linked_cross_swarm_conflicts:${crossSwarm.crossSwarmId}:${String(crossSwarm.unresolvedConflictCount)}`);
    }
    reasons.push(...crossSwarm.blockers.map((entry) => `linked_cross_swarm_blocker:${crossSwarm.crossSwarmId}:${entry}`));
    reasons.push(...crossSwarm.conflicts.map((entry) => `linked_cross_swarm_conflict:${crossSwarm.crossSwarmId}:${entry}`));
  }

  const readinessStates = uniqueSorted(input.link.linkedCrossSwarms.map((entry) => entry.readinessState));
  const contradictions: string[] = [];
  if (readinessStates.includes('coherent') && readinessStates.includes('blocked')) {
    contradictions.push('contradictory_readiness_signals');
  }

  return {
    blockingReasons: uniqueSorted([...reasons, ...contradictions]),
    contradictions,
    weakCoverage,
  };
}

function evaluateReadinessState(input: {
  link: MarketSynthesisLinkProjection;
  blockingReasons: string[];
  contradictions: string[];
}): MarketSynthesisReadinessState {
  if (!input.link.enabled || input.link.linkedCrossSwarms.length === 0) {
    return 'pending';
  }

  if (input.blockingReasons.length > 0 || input.contradictions.length > 0) {
    return 'blocked';
  }

  const readinessStates = input.link.linkedCrossSwarms.map((entry) => entry.readinessState);
  if (readinessStates.every((entry) => entry === 'coherent')) {
    return 'coherent';
  }
  if (readinessStates.some((entry) => entry === 'analyzing' || entry === 'coherent')) {
    return 'analyzing';
  }
  return 'pending';
}

function evaluateCompletionState(input: {
  link: MarketSynthesisLinkProjection;
  readinessState: MarketSynthesisReadinessState;
  weakCoverage: boolean;
  contradictions: string[];
  blockingReasons: string[];
}): MarketSynthesisCompletionState {
  if (!input.link.enabled) {
    return 'incomplete';
  }

  if (input.weakCoverage || input.contradictions.length > 0) {
    return 'inconclusive';
  }

  if (input.blockingReasons.length > 0 || input.readinessState === 'blocked') {
    return 'inconclusive';
  }

  const allComplete = input.link.linkedCrossSwarms.length > 0
    && input.link.linkedCrossSwarms.every((entry) => entry.completionSatisfied);

  if (allComplete && input.readinessState === 'coherent') {
    return 'completed';
  }

  return 'incomplete';
}

function buildStrengths(link: MarketSynthesisLinkProjection): string[] {
  const strengths: string[] = [];

  if (link.linkedCrossSwarms.length > 0) {
    strengths.push(`linked_cross_swarms:${String(link.linkedCrossSwarms.length)}`);
  }

  const coherentCount = link.linkedCrossSwarms.filter((entry) => entry.readinessState === 'coherent').length;
  if (coherentCount > 0) {
    strengths.push(`coherent_cross_swarms:${String(coherentCount)}`);
  }

  const completedCount = link.linkedCrossSwarms.filter((entry) => entry.completionSatisfied).length;
  if (completedCount > 0) {
    strengths.push(`completed_cross_swarms:${String(completedCount)}`);
  }

  return uniqueSorted(strengths);
}

function buildLimitations(input: {
  link: MarketSynthesisLinkProjection;
  completionState: MarketSynthesisCompletionState;
  blockingReasons: string[];
}): string[] {
  const limitations = [...input.blockingReasons];

  if (input.link.linkedCrossSwarms.some((entry) => entry.lifecycleState !== 'completed')) {
    limitations.push('linked_cross_swarms_still_progressing');
  }

  if (input.completionState === 'inconclusive') {
    limitations.push('completion_inconclusive');
  }

  return uniqueSorted(limitations);
}

export function createMarketSynthesisStatusProjection(options: {
  registry?: MarketSynthesisRegistry;
  linker?: MarketSynthesisLinker;
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
  now?: () => Date;
} = {}) {
  const registry = options.registry ?? createMarketSynthesisRegistry({
    definitionsDir: options.definitionsDir ?? options.marketSynthesisDefinitionsDir
  });

  const linker = options.linker ?? createMarketSynthesisLinker({
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
    now: options.now
  });

  function projectOne(marketSynthesisId: string): MarketSynthesisStatusProjection {
    const definition = registry.getDefinition(marketSynthesisId);
    const link = linker.buildLinks().find((entry) => entry.marketSynthesisId === marketSynthesisId);
    if (!link) {
      throw new Error(`MARKET_SYNTHESIS_NOT_FOUND: ${marketSynthesisId}`);
    }

    const minCrossSwarms = definition.scopeConstraints?.minCrossSwarms ?? 1;
    const { blockingReasons, contradictions, weakCoverage } = buildBlockingReasons({
      link,
      minCrossSwarms,
    });

    const lifecycleState = evaluateLifecycleState(link);
    const readinessState = evaluateReadinessState({
      link,
      blockingReasons,
      contradictions,
    });

    const completionState = evaluateCompletionState({
      link,
      readinessState,
      weakCoverage,
      contradictions,
      blockingReasons,
    });

    const strengths = buildStrengths(link);
    const limitations = buildLimitations({
      link,
      completionState,
      blockingReasons,
    });

    return {
      marketSynthesisId,
      displayName: definition.displayName,
      synthesisType: definition.synthesisType,
      enabled: definition.enabled,
      lifecycleState,
      readinessState,
      completionState,
      linkedCrossSwarmIds: [...link.linkedCrossSwarmIds].sort((left, right) => left.localeCompare(right)),
      linkedCrossSwarms: [...link.linkedCrossSwarms].sort((left, right) => left.crossSwarmId.localeCompare(right.crossSwarmId)),
      blockingReasons,
      strengths,
      limitations,
      rationale: [...link.rationale].sort((left, right) => left.localeCompare(right)),
    };
  }

  function projectAll(): MarketSynthesisStatusProjection[] {
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

export type MarketSynthesisStatusProjectionEngine = ReturnType<typeof createMarketSynthesisStatusProjection>;
