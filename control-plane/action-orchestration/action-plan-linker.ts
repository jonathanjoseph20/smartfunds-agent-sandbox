import {
  createPortfolioActionInspection,
  type PortfolioActionInspection,
} from '../portfolio-actions/portfolio-action-inspection.ts';

import {
  createActionPlanRegistry,
  type ActionPlanRegistry,
} from './action-plan-registry.ts';
import type {
  ActionPlanDefinition,
  ActionPlanLink,
  LinkedActionCandidate,
} from './action-plan-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function intersects(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((entry) => normalizeToken(entry)));
  return left
    .map((entry) => normalizeToken(entry))
    .filter((entry) => rightSet.has(entry))
    .sort((a, b) => a.localeCompare(b));
}

function familyFromDashOrUnderscore(value: string): string {
  const normalized = normalizeToken(value);
  return normalized.split(/[-_]/)[0] ?? normalized;
}

function asLifecycleState(value: string): LinkedActionCandidate['lifecycleState'] {
  if (
    value === 'inactive'
    || value === 'initializing'
    || value === 'active'
    || value === 'progressing'
    || value === 'stabilizing'
    || value === 'completed'
  ) {
    return value;
  }

  return 'inactive';
}

function asReadinessState(value: string): LinkedActionCandidate['readinessState'] {
  if (value === 'pending' || value === 'analyzing' || value === 'coherent' || value === 'blocked') {
    return value;
  }

  if (value === 'ready') {
    return 'coherent';
  }

  return 'pending';
}

function asCompletionState(value: string): LinkedActionCandidate['completionState'] {
  if (value === 'completed' || value === 'incomplete' || value === 'inconclusive') {
    return value;
  }

  return 'incomplete';
}

function asPriority(value: string): LinkedActionCandidate['priority'] {
  if (value === 'low' || value === 'normal' || value === 'high' || value === 'critical') {
    return value;
  }

  return 'normal';
}

function buildActionCandidates(inspection: PortfolioActionInspection): LinkedActionCandidate[] {
  return inspection
    .listPortfolioActions()
    .map((entry) => {
      const projection = inspection.inspectPortfolioAction(entry.actionId);

      return {
        actionId: entry.actionId,
        displayName: entry.displayName,
        actionType: entry.actionType,
        enabled: entry.enabled,
        lifecycleState: asLifecycleState(String(projection.lifecycleState ?? 'inactive')),
        readinessState: asReadinessState(String(projection.readinessState ?? 'pending')),
        completionState: asCompletionState(String(projection.completionState ?? 'incomplete')),
        priority: asPriority(String(projection.priority ?? 'normal')),
        routeCategory: String(projection.routeCategory ?? ''),
        riskThemes: Array.isArray(projection.riskThemes)
          ? [...projection.riskThemes as string[]].sort((left, right) => left.localeCompare(right))
          : [],
        blockingReasons: Array.isArray(projection.blockingReasons)
          ? [...projection.blockingReasons as string[]].sort((left, right) => left.localeCompare(right))
          : [],
        strengths: Array.isArray(projection.strengths)
          ? [...projection.strengths as string[]].sort((left, right) => left.localeCompare(right))
          : [],
        limitations: Array.isArray(projection.limitations)
          ? [...projection.limitations as string[]].sort((left, right) => left.localeCompare(right))
          : [],
      } satisfies LinkedActionCandidate;
    })
    .sort((left, right) => left.actionId.localeCompare(right.actionId));
}

function explicitDefinitionMatch(definition: ActionPlanDefinition, candidate: LinkedActionCandidate): string[] {
  const planFamilies = uniqueSorted([
    familyFromDashOrUnderscore(definition.actionPlanId),
    familyFromDashOrUnderscore(definition.planType),
  ]);

  const actionFamilies = uniqueSorted([
    familyFromDashOrUnderscore(candidate.actionId),
    familyFromDashOrUnderscore(candidate.actionType),
  ]);

  return intersects(planFamilies, actionFamilies);
}

function matchByRules(definition: ActionPlanDefinition, candidate: LinkedActionCandidate): {
  matches: boolean;
  rationale: string[];
} {
  const rationale: string[] = [];

  const explicit = explicitDefinitionMatch(definition, candidate);
  if (explicit.length > 0) {
    rationale.push(...explicit.map((entry) => `explicit_definition_match:${entry}`));
  }

  const routeRules = definition.matchingRules.routeCategories ?? [];
  if (routeRules.length > 0) {
    const overlaps = intersects([candidate.routeCategory], routeRules);
    if (overlaps.length > 0) {
      rationale.push(...overlaps.map((entry) => `matching_route_category:${entry}`));
    }
  }

  const riskThemeRules = definition.matchingRules.riskThemes ?? [];
  if (riskThemeRules.length > 0) {
    const overlaps = intersects(candidate.riskThemes, riskThemeRules);
    if (overlaps.length > 0) {
      rationale.push(...overlaps.map((entry) => `shared_risk_theme:${entry}`));
    }
  }

  if (rationale.length === 0) {
    return { matches: false, rationale: [] };
  }

  return {
    matches: true,
    rationale: uniqueSorted(rationale),
  };
}

export function createActionPlanLinker(options: {
  registry?: ActionPlanRegistry;
  portfolioActionInspection?: PortfolioActionInspection;
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
  let portfolioActionInspection = options.portfolioActionInspection;
  let cachedLinks: ActionPlanLink[] | undefined;

  function getPortfolioActionInspection(): PortfolioActionInspection {
    portfolioActionInspection ??= createPortfolioActionInspection({
      definitionsDir: options.portfolioActionDefinitionsDir,
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

    return portfolioActionInspection;
  }

  function buildLinks(): ActionPlanLink[] {
    if (cachedLinks) {
      return cachedLinks;
    }

    const candidates = buildActionCandidates(getPortfolioActionInspection());

    cachedLinks = registry
      .getActionPlanDefinitions()
      .map((definition) => {
        const linked = definition.enabled
          ? candidates
            .map((candidate) => {
              const match = matchByRules(definition, candidate);
              if (!match.matches) {
                return null;
              }

              return {
                candidate,
                rationale: match.rationale.map((entry) => `${candidate.actionId}:${entry}`),
              };
            })
            .filter((entry): entry is { candidate: LinkedActionCandidate; rationale: string[] } => entry !== null)
          : [];

        const linkedActions = linked
          .map((entry) => entry.candidate)
          .sort((left, right) => left.actionId.localeCompare(right.actionId));

        return {
          actionPlanId: definition.actionPlanId,
          linkedActionIds: linkedActions.map((entry) => entry.actionId),
          linkedActions,
          riskThemes: uniqueSorted(linkedActions.flatMap((entry) => entry.riskThemes)),
          routeCategories: uniqueSorted(linkedActions.map((entry) => entry.routeCategory).filter((entry) => entry.length > 0)),
          rationale: uniqueSorted(linked.flatMap((entry) => entry.rationale)),
        } satisfies ActionPlanLink;
      })
      .sort((left, right) => left.actionPlanId.localeCompare(right.actionPlanId));

    return cachedLinks;
  }

  return {
    buildLinks,
  };
}

export type ActionPlanLinker = ReturnType<typeof createActionPlanLinker>;
