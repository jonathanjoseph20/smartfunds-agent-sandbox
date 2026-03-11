import {
  createCrossSwarmInspection,
  type CrossSwarmInspection,
} from '../cross-swarms/cross-swarm-inspection.ts';

import {
  createMarketSynthesisRegistry,
  type MarketSynthesisRegistry,
} from './market-synthesis-registry.ts';
import type {
  LinkedCrossSwarmSummary,
  MarketSynthesisDefinition,
  MarketSynthesisLinkProjection,
  MarketSynthesisLifecycleState,
  MarketSynthesisReadinessState,
} from './market-synthesis-types.ts';

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

function toLifecycleState(value: string): MarketSynthesisLifecycleState {
  if (value === 'inactive' || value === 'initializing' || value === 'active' || value === 'progressing' || value === 'stabilizing' || value === 'completed') {
    return value;
  }
  if (value === 'activated') {
    return 'active';
  }
  return 'inactive';
}

function toReadinessState(value: string): MarketSynthesisReadinessState {
  if (value === 'pending' || value === 'analyzing' || value === 'coherent' || value === 'blocked') {
    return value;
  }
  return 'pending';
}

type CrossSwarmContext = LinkedCrossSwarmSummary;

function buildCrossSwarmContexts(inspection: CrossSwarmInspection): CrossSwarmContext[] {
  return inspection
    .listCrossSwarms()
    .map((entry) => {
      const projection = inspection.inspectCrossSwarm(entry.crossSwarmId);
      const linkedCrossSwarmFamilies = uniqueSorted([
        familyFromDashOrUnderscore(projection.crossSwarmId),
        familyFromDashOrUnderscore(projection.groupType)
      ]);

      return {
        crossSwarmId: projection.crossSwarmId,
        displayName: projection.displayName,
        groupType: projection.groupType,
        lifecycleState: toLifecycleState(projection.lifecycleState),
        readinessState: toReadinessState(projection.readinessState),
        completionSatisfied: projection.completion.isComplete,
        unresolvedConflictCount: projection.completion.unresolvedConflictCount,
        blockers: [...projection.blockers].sort((left, right) => left.localeCompare(right)),
        conflicts: [...projection.conflicts].sort((left, right) => left.localeCompare(right)),
        protocolFamilies: uniqueSorted(projection.linkedSwarms.flatMap((linked) => linked.protocolFamilies)),
        assetFamilies: uniqueSorted(projection.linkedSwarms.flatMap((linked) => linked.assetFamilies)),
        eventFamilies: uniqueSorted(projection.linkedSwarms.flatMap((linked) => linked.eventFamilies)),
        responseFamilies: linkedCrossSwarmFamilies
      };
    })
    .sort((left, right) => left.crossSwarmId.localeCompare(right.crossSwarmId));
}

function explicitDefinitionMatch(definition: MarketSynthesisDefinition, context: CrossSwarmContext): string[] {
  const synthesisFamilies = uniqueSorted([
    familyFromDashOrUnderscore(definition.marketSynthesisId),
    familyFromDashOrUnderscore(definition.synthesisType)
  ]);
  const crossFamilies = uniqueSorted([
    familyFromDashOrUnderscore(context.crossSwarmId),
    familyFromDashOrUnderscore(context.groupType),
    ...context.responseFamilies
  ]);

  return intersects(synthesisFamilies, crossFamilies);
}

function matchByRules(definition: MarketSynthesisDefinition, context: CrossSwarmContext): {
  matches: boolean;
  rationale: string[];
} {
  const rationale: string[] = [];

  const explicit = explicitDefinitionMatch(definition, context);
  if (explicit.length > 0) {
    rationale.push(...explicit.map((entry) => `explicit_definition_match:${entry}`));
  }

  const eventFamilies = definition.crossSwarmMatchingRules.eventFamilies ?? [];
  if (eventFamilies.length > 0) {
    const overlap = intersects(context.eventFamilies, eventFamilies);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_event_family:${entry}`));
  }

  const protocolFamilies = definition.crossSwarmMatchingRules.protocolFamilies ?? [];
  if (protocolFamilies.length > 0) {
    const overlap = intersects(context.protocolFamilies, protocolFamilies);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_protocol_family:${entry}`));
  }

  const assetFamilies = definition.crossSwarmMatchingRules.assetFamilies ?? [];
  if (assetFamilies.length > 0) {
    const overlap = intersects(context.assetFamilies, assetFamilies);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_asset_family:${entry}`));
  }

  const responseFamilies = definition.crossSwarmMatchingRules.responseFamilies ?? [];
  if (responseFamilies.length > 0) {
    const overlap = intersects(context.responseFamilies, responseFamilies);
    if (overlap.length === 0) {
      return { matches: false, rationale: [] };
    }
    rationale.push(...overlap.map((entry) => `shared_response_family:${entry}`));
  }

  if (rationale.length === 0) {
    return { matches: false, rationale: [] };
  }

  return {
    matches: true,
    rationale: uniqueSorted(rationale)
  };
}

export function createMarketSynthesisLinker(options: {
  registry?: MarketSynthesisRegistry;
  crossSwarmInspection?: CrossSwarmInspection;
  definitionsDir?: string;
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
  const registry = options.registry ?? createMarketSynthesisRegistry({ definitionsDir: options.definitionsDir });

  const crossSwarmInspection = options.crossSwarmInspection ?? createCrossSwarmInspection({
    definitionsDir: options.crossSwarmDefinitionsDir,
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

  function buildLinks(): MarketSynthesisLinkProjection[] {
    const contexts = buildCrossSwarmContexts(crossSwarmInspection);

    return registry
      .listDefinitions()
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
                rationale: match.rationale.map((entry) => `${context.crossSwarmId}:${entry}`)
              };
            })
            .filter((entry): entry is { context: CrossSwarmContext; rationale: string[] } => entry !== null)
          : [];

        const linkedCrossSwarms = linked
          .map((entry) => entry.context)
          .sort((left, right) => left.crossSwarmId.localeCompare(right.crossSwarmId));

        const linkedCrossSwarmIds = linkedCrossSwarms
          .map((entry) => entry.crossSwarmId)
          .sort((left, right) => left.localeCompare(right));

        return {
          marketSynthesisId: definition.marketSynthesisId,
          displayName: definition.displayName,
          synthesisType: definition.synthesisType,
          enabled: definition.enabled,
          linkedCrossSwarmIds,
          linkedCrossSwarms,
          rationale: uniqueSorted(linked.flatMap((entry) => entry.rationale))
        } satisfies MarketSynthesisLinkProjection;
      })
      .sort((left, right) => left.marketSynthesisId.localeCompare(right.marketSynthesisId));
  }

  return {
    buildLinks
  };
}

export type MarketSynthesisLinker = ReturnType<typeof createMarketSynthesisLinker>;
