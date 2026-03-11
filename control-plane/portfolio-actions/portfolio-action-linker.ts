import {
  createPortfolioInspection,
  type PortfolioInspection,
} from '../portfolio-intelligence/portfolio-inspection.ts';

import {
  createPortfolioActionRegistry,
  type PortfolioActionRegistry,
} from './portfolio-action-registry.ts';
import type {
  LinkedPortfolioActionUnit,
  LinkedPortfolioSummary,
  PortfolioActionDefinition,
} from './portfolio-action-types.ts';

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

function extractMarketEventFamilies(input: {
  riskThemes: string[];
  exposureFlags: string[];
  concentrationWarnings: string[];
}): string[] {
  const families: string[] = [];

  for (const flag of input.exposureFlags) {
    if (flag.startsWith('event_exposure:')) {
      families.push(flag.slice('event_exposure:'.length));
    }
  }

  const inferredFromThemes = input.riskThemes.flatMap((theme) => {
    if (theme.includes('governance')) {
      return ['governance'];
    }
    if (theme.includes('liquidity')) {
      return ['liquidity'];
    }
    if (theme.includes('yield')) {
      return ['yield'];
    }
    if (theme.includes('protocol')) {
      return ['protocol'];
    }
    return [];
  });

  const inferredFromWarnings = input.concentrationWarnings.flatMap((warning) => {
    if (warning.startsWith('event_concentration:')) {
      const parts = warning.split(':');
      return parts[1] ? [parts[1]] : [];
    }
    if (warning.startsWith('protocol_concentration:')) {
      return ['protocol'];
    }
    return [];
  });

  return uniqueSorted([...families, ...inferredFromThemes, ...inferredFromWarnings]);
}

function asActionLifecycleState(value: string): LinkedPortfolioSummary['lifecycleState'] {
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

function asActionCompletionState(value: string): LinkedPortfolioSummary['completionState'] {
  if (value === 'completed' || value === 'incomplete' || value === 'inconclusive') {
    return value;
  }
  return 'incomplete';
}

type PortfolioContext = LinkedPortfolioSummary;

function buildPortfolioContexts(inspection: PortfolioInspection): PortfolioContext[] {
  return inspection
    .listPortfolioIntelligenceUnits()
    .map((entry) => {
      const projection = inspection.inspectPortfolioIntelligence(entry.portfolioId);

      return {
        portfolioId: entry.portfolioId,
        displayName: entry.displayName,
        portfolioType: String(projection.portfolioType ?? ''),
        lifecycleState: asActionLifecycleState(String(projection.lifecycleState ?? 'inactive')),
        readinessState: projection.readinessState,
        completionState: asActionCompletionState(String(projection.completionState ?? 'incomplete')),
        blockingReasons: Array.isArray(projection.blockingReasons)
          ? [...projection.blockingReasons as string[]].sort((left, right) => left.localeCompare(right))
          : [],
        limitations: Array.isArray(projection.limitations)
          ? [...projection.limitations as string[]].sort((left, right) => left.localeCompare(right))
          : [],
        riskThemes: Array.isArray(projection.riskThemes)
          ? [...projection.riskThemes as string[]].sort((left, right) => left.localeCompare(right))
          : [],
        exposureFlags: Array.isArray(projection.exposureFlags)
          ? [...projection.exposureFlags as string[]].sort((left, right) => left.localeCompare(right))
          : [],
        concentrationWarnings: Array.isArray(projection.concentrationWarnings)
          ? [...projection.concentrationWarnings as string[]].sort((left, right) => left.localeCompare(right))
          : [],
      } satisfies LinkedPortfolioSummary;
    })
    .sort((left, right) => left.portfolioId.localeCompare(right.portfolioId));
}

function explicitDefinitionMatch(definition: PortfolioActionDefinition, context: PortfolioContext): string[] {
  const actionFamilies = uniqueSorted([
    familyFromDashOrUnderscore(definition.actionId),
    familyFromDashOrUnderscore(definition.actionType),
  ]);

  const portfolioFamilies = uniqueSorted([
    familyFromDashOrUnderscore(context.portfolioId),
    familyFromDashOrUnderscore(context.portfolioType),
  ]);

  return intersects(actionFamilies, portfolioFamilies);
}

function matchByRules(definition: PortfolioActionDefinition, context: PortfolioContext): {
  matches: boolean;
  rationale: string[];
} {
  const rationale: string[] = [];

  const explicit = explicitDefinitionMatch(definition, context);
  if (explicit.length > 0) {
    rationale.push(...explicit.map((entry) => `explicit_definition_match:${entry}`));
  }

  const riskThemeRules = definition.portfolioMatchRules.riskThemes ?? [];
  if (riskThemeRules.length > 0) {
    const overlap = intersects(context.riskThemes, riskThemeRules);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_risk_theme:${entry}`));
  }

  const exposureRules = definition.portfolioMatchRules.exposureFlags ?? [];
  if (exposureRules.length > 0) {
    const overlap = intersects(context.exposureFlags, exposureRules);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_exposure_flag:${entry}`));
  }

  const concentrationRules = definition.portfolioMatchRules.concentrationWarnings ?? [];
  if (concentrationRules.length > 0) {
    const ruleTokenized = concentrationRules.map((entry) => normalizeToken(entry));
    const overlap = context.concentrationWarnings
      .filter((warning) => ruleTokenized.some((rule) => normalizeToken(warning).includes(rule)))
      .map((warning) => normalizeToken(warning))
      .sort((a, b) => a.localeCompare(b));

    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_concentration_warning:${entry}`));
  }

  const marketEventRules = definition.portfolioMatchRules.marketEventFamilies ?? [];
  if (marketEventRules.length > 0) {
    const marketFamilies = extractMarketEventFamilies({
      riskThemes: context.riskThemes,
      exposureFlags: context.exposureFlags,
      concentrationWarnings: context.concentrationWarnings,
    });
    const overlap = intersects(marketFamilies, marketEventRules);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_market_event_family:${entry}`));
  }

  if (rationale.length === 0) {
    return { matches: false, rationale: [] };
  }

  return {
    matches: true,
    rationale: uniqueSorted(rationale),
  };
}

export function createPortfolioActionLinker(options: {
  registry?: PortfolioActionRegistry;
  portfolioInspection?: PortfolioInspection;
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

  const portfolioInspection = options.portfolioInspection ?? createPortfolioInspection({
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

  function buildLinks(): LinkedPortfolioActionUnit[] {
    const contexts = buildPortfolioContexts(portfolioInspection);

    return registry
      .getActionDefinitions()
      .map((definition) => {
        const linked = definition.enabled
          ? contexts
            .map((context) => {
              const match = matchByRules(definition, context);
              if (!match.matches) {
                return null;
              }
              return {
                context,
                rationale: match.rationale.map((entry) => `${context.portfolioId}:${entry}`),
              };
            })
            .filter((entry): entry is { context: PortfolioContext; rationale: string[] } => entry !== null)
          : [];

        const linkedPortfolios = linked
          .map((entry) => entry.context)
          .sort((left, right) => left.portfolioId.localeCompare(right.portfolioId));

        const linkedPortfolioIds = linkedPortfolios
          .map((entry) => entry.portfolioId)
          .sort((left, right) => left.localeCompare(right));

        return {
          actionId: definition.actionId,
          linkedPortfolioIds,
          linkedPortfolios,
          riskThemes: uniqueSorted(linkedPortfolios.flatMap((entry) => entry.riskThemes)),
          exposureFlags: uniqueSorted(linkedPortfolios.flatMap((entry) => entry.exposureFlags)),
          concentrationWarnings: uniqueSorted(linkedPortfolios.flatMap((entry) => entry.concentrationWarnings)),
          rationale: uniqueSorted(linked.flatMap((entry) => entry.rationale)),
        } satisfies LinkedPortfolioActionUnit;
      })
      .sort((left, right) => left.actionId.localeCompare(right.actionId));
  }

  return {
    buildLinks,
  };
}

export type PortfolioActionLinker = ReturnType<typeof createPortfolioActionLinker>;
