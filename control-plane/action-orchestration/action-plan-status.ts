import {
  createActionPlanLinker,
  type ActionPlanLinker,
} from './action-plan-linker.ts';
import {
  evaluateActionPlanPriority,
} from './action-plan-priority.ts';
import {
  createActionPlanRegistry,
  type ActionPlanRegistry,
} from './action-plan-registry.ts';
import {
  evaluateActionPlanRouteSummary,
} from './action-plan-route-summary.ts';
import type {
  ActionPlanCompletionState,
  ActionPlanDefinition,
  ActionPlanLifecycleState,
  ActionPlanReadinessState,
  ActionPlanStatusProjection,
} from './action-plan-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function evaluateReadiness(input: {
  definition: ActionPlanDefinition;
  link: ReturnType<ActionPlanLinker['buildLinks']>[number];
}): {
  readinessState: ActionPlanReadinessState;
  blockingReasons: string[];
  strengths: string[];
  limitations: string[];
} {
  if (!input.definition.enabled) {
    return {
      readinessState: 'pending',
      blockingReasons: ['plan_disabled'],
      strengths: [],
      limitations: ['plan_disabled'],
    };
  }

  if (input.link.linkedActionIds.length === 0) {
    return {
      readinessState: 'pending',
      blockingReasons: ['insufficient_action_candidates'],
      strengths: [],
      limitations: ['insufficient_action_candidates', 'weak_plan_support'],
    };
  }

  const blockingReasons: string[] = [];

  if (input.link.linkedActions.some((entry) => entry.readinessState === 'blocked')) {
    blockingReasons.push('blocked_action_candidate_present');
  }

  if (input.link.linkedActions.some((entry) => entry.blockingReasons.includes('contradictory_exposure_signals'))) {
    blockingReasons.push('contradictory_action_signals');
  }

  if (
    input.link.routeCategories.includes('escalate')
    && (input.link.routeCategories.includes('monitor') || input.link.routeCategories.includes('review'))
  ) {
    blockingReasons.push('unresolved_route_conflicts');
  }

  if (input.link.linkedActions.some((entry) => entry.readinessState === 'pending' || entry.readinessState === 'analyzing')) {
    blockingReasons.push('upstream_action_analysis_incomplete');
  }

  const strengths = uniqueSorted([
    `linked_actions:${String(input.link.linkedActionIds.length)}`,
    ...(input.link.riskThemes.length > 0 ? [`risk_themes:${String(input.link.riskThemes.length)}`] : []),
    ...(input.link.routeCategories.length > 0 ? [`route_categories:${String(input.link.routeCategories.length)}`] : []),
  ]);

  const normalizedBlockingReasons = uniqueSorted(blockingReasons);

  const limitations = uniqueSorted([
    ...normalizedBlockingReasons,
    ...(input.link.linkedActions.some((entry) => entry.completionState === 'inconclusive')
      ? ['upstream_action_completion_inconclusive']
      : []),
  ]);

  if (normalizedBlockingReasons.length > 0) {
    return {
      readinessState: 'blocked',
      blockingReasons: normalizedBlockingReasons,
      strengths,
      limitations,
    };
  }

  if (input.link.linkedActions.every((entry) => entry.readinessState === 'coherent')) {
    return {
      readinessState: 'coherent',
      blockingReasons: [],
      strengths,
      limitations,
    };
  }

  if (input.link.linkedActions.some((entry) => entry.readinessState === 'analyzing' || entry.readinessState === 'coherent')) {
    return {
      readinessState: 'analyzing',
      blockingReasons: [],
      strengths,
      limitations,
    };
  }

  return {
    readinessState: 'pending',
    blockingReasons: [],
    strengths,
    limitations,
  };
}

function evaluateCompletion(input: {
  definition: ActionPlanDefinition;
  link: ReturnType<ActionPlanLinker['buildLinks']>[number];
  readinessState: ActionPlanReadinessState;
  blockingReasons: string[];
}): {
  completionState: ActionPlanCompletionState;
  limitations: string[];
} {
  if (!input.definition.enabled) {
    return {
      completionState: 'incomplete',
      limitations: ['plan_disabled'],
    };
  }

  if (input.readinessState === 'blocked' || input.blockingReasons.length > 0) {
    return {
      completionState: 'inconclusive',
      limitations: uniqueSorted(['completion_inconclusive', ...input.blockingReasons]),
    };
  }

  if (input.link.linkedActions.some((entry) => entry.completionState === 'inconclusive')) {
    return {
      completionState: 'inconclusive',
      limitations: uniqueSorted(['upstream_action_completion_inconclusive', 'completion_inconclusive']),
    };
  }

  const allCompleted = input.link.linkedActions.length > 0
    && input.link.linkedActions.every((entry) => entry.completionState === 'completed' || entry.lifecycleState === 'completed');

  if (allCompleted && input.readinessState === 'coherent') {
    return {
      completionState: 'completed',
      limitations: [],
    };
  }

  return {
    completionState: 'incomplete',
    limitations: uniqueSorted([
      ...(input.link.linkedActions.some((entry) => entry.completionState !== 'completed')
        ? ['linked_actions_still_progressing']
        : []),
    ]),
  };
}

function evaluateLifecycleState(input: {
  definition: ActionPlanDefinition;
  link: ReturnType<ActionPlanLinker['buildLinks']>[number];
  readinessState: ActionPlanReadinessState;
  completionState: ActionPlanCompletionState;
}): ActionPlanLifecycleState {
  if (!input.definition.enabled || input.link.linkedActionIds.length === 0) {
    return 'inactive';
  }

  if (input.completionState === 'completed') {
    return 'completed';
  }

  if (input.completionState === 'inconclusive' || input.readinessState === 'blocked') {
    return 'stabilizing';
  }

  const states = input.link.linkedActions.map((entry) => entry.lifecycleState);

  if (states.some((state) => state === 'progressing')) {
    return 'progressing';
  }

  if (states.some((state) => state === 'active')) {
    return 'active';
  }

  return 'initializing';
}

export function createActionPlanStatusProjection(options: {
  registry?: ActionPlanRegistry;
  linker?: ActionPlanLinker;
  definitionsDir?: string;
  actionPlanDefinitionsDir?: string;
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
  portfolioActionArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const definitionsDir = options.definitionsDir ?? options.actionPlanDefinitionsDir;

  const registry = options.registry ?? createActionPlanRegistry({ definitionsDir });

  const linker = options.linker ?? createActionPlanLinker({
    registry,
    definitionsDir,
    portfolioActionDefinitionsDir: options.portfolioActionDefinitionsDir,
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
    portfolioActionArtifactsRoot: options.portfolioActionArtifactsRoot,
    now: options.now,
  });

  function projectOne(actionPlanId: string): ActionPlanStatusProjection {
    const definition = registry.getActionPlanDefinitionById(actionPlanId);
    const link = linker.buildLinks().find((entry) => entry.actionPlanId === actionPlanId);

    if (!link) {
      throw new Error(`ACTION_PLAN_NOT_FOUND: ${actionPlanId}`);
    }

    const readiness = evaluateReadiness({ definition, link });
    const completion = evaluateCompletion({
      definition,
      link,
      readinessState: readiness.readinessState,
      blockingReasons: readiness.blockingReasons,
    });

    const priority = evaluateActionPlanPriority({
      actionPlanId,
      link,
      readinessState: readiness.readinessState,
      completionState: completion.completionState,
    });

    const routeSummary = evaluateActionPlanRouteSummary({
      actionPlanId,
      link,
    });

    const lifecycleState = evaluateLifecycleState({
      definition,
      link,
      readinessState: readiness.readinessState,
      completionState: completion.completionState,
    });

    return {
      actionPlanId,
      displayName: definition.displayName,
      planType: definition.planType,
      enabled: definition.enabled,
      lifecycleState,
      readinessState: readiness.readinessState,
      completionState: completion.completionState,
      priority: priority.priority,
      routeSummary: routeSummary.routeSummary,
      linkedActionIds: [...link.linkedActionIds].sort((left, right) => left.localeCompare(right)),
      linkedActions: [...link.linkedActions].sort((left, right) => left.actionId.localeCompare(right.actionId)),
      blockingReasons: [...readiness.blockingReasons],
      strengths: uniqueSorted(readiness.strengths),
      limitations: uniqueSorted([...readiness.limitations, ...completion.limitations]),
      rationale: [...link.rationale].sort((left, right) => left.localeCompare(right)),
      priorityReasons: [...priority.reasons].sort((left, right) => left.localeCompare(right)),
      routeSummaryReasons: [...routeSummary.reasons].sort((left, right) => left.localeCompare(right)),
    };
  }

  function projectAll(): ActionPlanStatusProjection[] {
    return registry
      .getActionPlanDefinitions()
      .map((definition) => projectOne(definition.actionPlanId))
      .sort((left, right) => left.actionPlanId.localeCompare(right.actionPlanId));
  }

  return {
    projectOne,
    projectAll,
  };
}

export type ActionPlanStatusProjectionEngine = ReturnType<typeof createActionPlanStatusProjection>;
