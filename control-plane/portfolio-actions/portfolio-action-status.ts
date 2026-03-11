import {
  evaluatePortfolioActionCompletion,
} from './portfolio-action-completion.ts';
import {
  createPortfolioActionLinker,
  type PortfolioActionLinker,
} from './portfolio-action-linker.ts';
import {
  evaluatePortfolioActionPriority,
} from './portfolio-action-priority.ts';
import {
  evaluatePortfolioActionReadiness,
} from './portfolio-action-readiness.ts';
import {
  createPortfolioActionRegistry,
  type PortfolioActionRegistry,
} from './portfolio-action-registry.ts';
import type {
  LinkedPortfolioActionUnit,
  PortfolioActionDefinition,
  PortfolioActionLifecycleState,
  PortfolioActionStatusProjection,
} from './portfolio-action-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function evaluateLifecycleState(input: {
  definition: PortfolioActionDefinition;
  link: LinkedPortfolioActionUnit;
  readinessState: 'pending' | 'analyzing' | 'ready' | 'blocked';
  completionState: 'completed' | 'incomplete' | 'inconclusive';
}): PortfolioActionLifecycleState {
  if (!input.definition.enabled || input.link.linkedPortfolioIds.length === 0) {
    return 'inactive';
  }

  if (input.completionState === 'completed') {
    return 'completed';
  }

  if (input.completionState === 'inconclusive' || input.readinessState === 'blocked') {
    return 'stabilizing';
  }

  const states = input.link.linkedPortfolios.map((portfolio) => portfolio.lifecycleState);

  if (states.some((state) => state === 'progressing')) {
    return 'progressing';
  }

  if (states.some((state) => state === 'active')) {
    return 'active';
  }

  return 'initializing';
}

export function createPortfolioActionStatusProjection(options: {
  registry?: PortfolioActionRegistry;
  linker?: PortfolioActionLinker;
  definitionsDir?: string;
  portfolioActionDefinitionsDir?: string;
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
  const registry = options.registry ?? createPortfolioActionRegistry({
    definitionsDir: options.definitionsDir ?? options.portfolioActionDefinitionsDir,
  });

  const linker = options.linker ?? createPortfolioActionLinker({
    registry,
    definitionsDir: options.definitionsDir ?? options.portfolioActionDefinitionsDir,
    portfolioDefinitionsDir: options.portfolioDefinitionsDir,
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

  function projectOne(actionId: string): PortfolioActionStatusProjection {
    const definition = registry.getActionDefinitionById(actionId);
    const link = linker.buildLinks().find((entry) => entry.actionId === actionId);

    if (!link) {
      throw new Error(`PORTFOLIO_ACTION_NOT_FOUND: ${actionId}`);
    }

    const readiness = evaluatePortfolioActionReadiness({
      definition,
      link,
    });

    const completion = evaluatePortfolioActionCompletion({
      definition,
      link,
      readiness,
    });

    const priority = evaluatePortfolioActionPriority({
      definition,
      link,
      readiness,
      completion,
    });

    const lifecycleState = evaluateLifecycleState({
      definition,
      link,
      readinessState: readiness.readinessState,
      completionState: completion.completionState,
    });

    const limitations = uniqueSorted([
      ...readiness.limitations,
      ...completion.limitations,
      ...(link.linkedPortfolios.some((portfolio) => portfolio.lifecycleState !== 'completed')
        ? ['linked_portfolios_still_progressing']
        : []),
    ]);

    const strengths = uniqueSorted([
      ...readiness.strengths,
      ...(link.rationale.length > 0 ? [`link_rationale_count:${String(link.rationale.length)}`] : []),
      ...(link.riskThemes.length > 0 ? [`risk_theme_count:${String(link.riskThemes.length)}`] : []),
    ]);

    return {
      actionId,
      displayName: definition.displayName,
      actionType: definition.actionType,
      enabled: definition.enabled,
      lifecycleState,
      readinessState: readiness.readinessState,
      completionState: completion.completionState,
      priority: priority.priority,
      routeCategory: priority.routeCategory,
      linkedPortfolioIds: [...link.linkedPortfolioIds].sort((left, right) => left.localeCompare(right)),
      linkedPortfolios: [...link.linkedPortfolios].sort((left, right) => left.portfolioId.localeCompare(right.portfolioId)),
      blockingReasons: [...readiness.blockingReasons],
      riskThemes: [...link.riskThemes].sort((left, right) => left.localeCompare(right)),
      exposureFlags: [...link.exposureFlags].sort((left, right) => left.localeCompare(right)),
      concentrationWarnings: [...link.concentrationWarnings].sort((left, right) => left.localeCompare(right)),
      strengths,
      limitations,
      rationale: [...link.rationale].sort((left, right) => left.localeCompare(right)),
      priorityReasons: [...priority.reasons].sort((left, right) => left.localeCompare(right)),
    };
  }

  function projectAll(): PortfolioActionStatusProjection[] {
    return registry
      .getActionDefinitions()
      .map((definition) => projectOne(definition.actionId))
      .sort((left, right) => left.actionId.localeCompare(right.actionId));
  }

  return {
    projectOne,
    projectAll,
  };
}

export type PortfolioActionStatusProjectionEngine = ReturnType<typeof createPortfolioActionStatusProjection>;
