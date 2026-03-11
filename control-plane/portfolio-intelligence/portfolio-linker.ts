import {
  createMarketInspection,
  type MarketInspection,
} from '../market-synthesis/market-synthesis-inspection.ts';

import {
  createPortfolioRegistry,
  type PortfolioRegistry,
} from './portfolio-registry.ts';
import type {
  LinkedMarketSynthesisSummary,
  PortfolioDefinition,
  PortfolioLinkResult,
} from './portfolio-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function familyFromDashOrUnderscore(value: string): string {
  const normalized = normalizeToken(value);
  return normalized.split(/[-_]/)[0] ?? normalized;
}

function intersects(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((entry) => normalizeToken(entry)));
  return left
    .map((entry) => normalizeToken(entry))
    .filter((entry) => rightSet.has(entry))
    .sort((a, b) => a.localeCompare(b));
}

function toLifecycle(value: string): LinkedMarketSynthesisSummary['lifecycleState'] {
  if (value === 'inactive' || value === 'initializing' || value === 'active' || value === 'progressing' || value === 'stabilizing' || value === 'completed') {
    return value;
  }
  return 'inactive';
}

function toReadiness(value: string): LinkedMarketSynthesisSummary['readinessState'] {
  if (value === 'pending' || value === 'analyzing' || value === 'coherent' || value === 'blocked') {
    return value;
  }
  return 'pending';
}

function toCompletion(value: string): LinkedMarketSynthesisSummary['completionState'] {
  if (value === 'completed' || value === 'incomplete' || value === 'inconclusive') {
    return value;
  }
  return 'incomplete';
}

type MarketContext = LinkedMarketSynthesisSummary;

function buildMarketContexts(inspection: MarketInspection): MarketContext[] {
  return inspection
    .listMarketSyntheses()
    .map((entry) => {
      const projection = inspection.inspectMarketSynthesis(entry.marketSynthesisId);
      const linkedCrossSwarms = Array.isArray(projection.linkedCrossSwarms)
        ? projection.linkedCrossSwarms as Array<Record<string, unknown>>
        : [];

      const protocolFamilies = uniqueSorted(linkedCrossSwarms
        .flatMap((linked) => (Array.isArray(linked.protocolFamilies) ? linked.protocolFamilies : []))
        .map((value) => String(value).trim().toLowerCase())
        .filter((value) => value.length > 0));

      const assetFamilies = uniqueSorted(linkedCrossSwarms
        .flatMap((linked) => (Array.isArray(linked.assetFamilies) ? linked.assetFamilies : []))
        .map((value) => String(value).trim().toLowerCase())
        .filter((value) => value.length > 0));

      const eventFamilies = uniqueSorted(linkedCrossSwarms
        .flatMap((linked) => (Array.isArray(linked.eventFamilies) ? linked.eventFamilies : []))
        .map((value) => String(value).trim().toLowerCase())
        .filter((value) => value.length > 0));

      return {
        marketSynthesisId: entry.marketSynthesisId,
        displayName: entry.displayName,
        synthesisType: entry.synthesisType,
        lifecycleState: toLifecycle(String(projection.lifecycleState ?? 'inactive')),
        readinessState: toReadiness(String(projection.readinessState ?? 'pending')),
        completionState: toCompletion(String(projection.completionState ?? 'incomplete')),
        blockingReasons: Array.isArray(projection.blockingReasons)
          ? [...projection.blockingReasons as string[]].sort((left, right) => left.localeCompare(right))
          : [],
        limitations: Array.isArray(projection.limitations)
          ? [...projection.limitations as string[]].sort((left, right) => left.localeCompare(right))
          : [],
        rationale: Array.isArray(projection.rationale)
          ? [...projection.rationale as string[]].sort((left, right) => left.localeCompare(right))
          : [],
        protocolFamilies,
        assetFamilies,
        eventFamilies,
      } satisfies LinkedMarketSynthesisSummary;
    })
    .sort((left, right) => left.marketSynthesisId.localeCompare(right.marketSynthesisId));
}

function explicitDefinitionMatch(definition: PortfolioDefinition, context: MarketContext): string[] {
  const portfolioFamilies = uniqueSorted([
    familyFromDashOrUnderscore(definition.portfolioId),
    familyFromDashOrUnderscore(definition.portfolioType),
  ]);
  const marketFamilies = uniqueSorted([
    familyFromDashOrUnderscore(context.marketSynthesisId),
    familyFromDashOrUnderscore(context.synthesisType),
  ]);

  return intersects(portfolioFamilies, marketFamilies);
}

function matchByRules(definition: PortfolioDefinition, context: MarketContext): {
  matches: boolean;
  rationale: string[];
} {
  const rationale: string[] = [];

  const explicit = explicitDefinitionMatch(definition, context);
  if (explicit.length > 0) {
    rationale.push(...explicit.map((entry) => `explicit_definition_match:${entry}`));
  }

  const marketSynthesisIds = definition.matchingRules.marketSynthesisIds ?? [];
  if (marketSynthesisIds.length > 0) {
    const overlap = intersects([context.marketSynthesisId], marketSynthesisIds);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `explicit_definition_match:${entry}`));
  }

  const synthesisTypes = definition.matchingRules.synthesisTypes ?? [];
  if (synthesisTypes.length > 0) {
    const overlap = intersects([context.synthesisType], synthesisTypes);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `explicit_definition_match:${entry}`));
  }

  const protocolFamilies = definition.matchingRules.protocolFamilies ?? [];
  if (protocolFamilies.length > 0) {
    const overlap = intersects(context.protocolFamilies, protocolFamilies);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_protocol_family:${entry}`));
  }

  const assetFamilies = definition.matchingRules.assetFamilies ?? [];
  if (assetFamilies.length > 0) {
    const overlap = intersects(context.assetFamilies, assetFamilies);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_asset_family:${entry}`));
  }

  const eventFamilies = definition.matchingRules.eventFamilies ?? [];
  if (eventFamilies.length > 0) {
    const overlap = intersects(context.eventFamilies, eventFamilies);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_event_family:${entry}`));
  }

  if (rationale.length === 0) {
    return { matches: false, rationale: [] };
  }

  return {
    matches: true,
    rationale: uniqueSorted(rationale),
  };
}

export function createPortfolioLinker(options: {
  registry?: PortfolioRegistry;
  marketInspection?: MarketInspection;
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
  let marketInspection = options.marketInspection;
  let cachedLinks: PortfolioLinkResult[] | undefined;

  function getMarketInspection(): MarketInspection {
    marketInspection ??= createMarketInspection({
      definitionsDir: options.marketSynthesisDefinitionsDir,
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

    return marketInspection;
  }

  function buildLinks(): PortfolioLinkResult[] {
    if (cachedLinks) {
      return cachedLinks;
    }

    const contexts = buildMarketContexts(getMarketInspection());

    cachedLinks = registry
      .listPortfolioDefinitions()
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
                rationale: match.rationale.map((entry) => `${context.marketSynthesisId}:${entry}`)
              };
            })
            .filter((entry): entry is { context: MarketContext; rationale: string[] } => entry !== null)
          : [];

        const linkedMarketSyntheses = linked
          .map((entry) => entry.context)
          .sort((left, right) => left.marketSynthesisId.localeCompare(right.marketSynthesisId));

        const linkedMarketSynthesisIds = linkedMarketSyntheses
          .map((entry) => entry.marketSynthesisId)
          .sort((left, right) => left.localeCompare(right));

        return {
          portfolioId: definition.portfolioId,
          linkedMarketSynthesisIds,
          linkedMarketSyntheses,
          rationale: uniqueSorted(linked.flatMap((entry) => entry.rationale)),
        } satisfies PortfolioLinkResult;
      })
      .sort((left, right) => left.portfolioId.localeCompare(right.portfolioId));

    return cachedLinks;
  }

  return {
    buildLinks,
  };
}

export type PortfolioLinker = ReturnType<typeof createPortfolioLinker>;
