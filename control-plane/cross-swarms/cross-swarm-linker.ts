import { createCohortRegistry, type CohortRegistry } from '../cohorts/cohort-registry.ts';
import { createInvestigationInspection, type InvestigationInspection } from '../investigations/investigation-inspection.ts';
import { createSwarmInspection, type SwarmInspection } from '../research-swarms/swarm-inspection.ts';
import { createSwarmRegistry, type SwarmRegistry } from '../research-swarms/swarm-registry.ts';
import {
  createResearchTeamAttachmentResolver,
  type ResearchTeamAttachmentResolver
} from '../research-teams/research-team-attachment.ts';
import { createSignalStore, type SignalStore } from '../signals/signal-store.ts';

import { createCrossSwarmRegistry, type CrossSwarmRegistry } from './cross-swarm-registry.ts';
import type {
  CrossSwarmLifecycleState,
  CrossSwarmLinkedSwarm,
  CrossSwarmLinkRationale,
  CrossSwarmMatchDimension,
  CrossSwarmReadinessState
} from './cross-swarm-types.ts';

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

function toCrossLifecycleState(value: string): CrossSwarmLifecycleState {
  if (value === 'inactive' || value === 'initializing' || value === 'progressing' || value === 'stabilizing' || value === 'completed') {
    return value;
  }
  if (value === 'activated' || value === 'active') {
    return 'active';
  }
  return 'inactive';
}

function toCrossReadinessState(value: string): CrossSwarmReadinessState {
  if (value === 'pending' || value === 'analyzing' || value === 'coherent' || value === 'blocked') {
    return value;
  }
  return 'pending';
}

function intersects(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((entry) => normalizeToken(entry)));
  return left
    .map((entry) => normalizeToken(entry))
    .filter((entry) => rightSet.has(entry))
    .sort((a, b) => a.localeCompare(b));
}

type SwarmContext = {
  swarmId: string;
  swarmDisplayName: string;
  teamId: string;
  lifecycleState: CrossSwarmLifecycleState;
  readinessState: CrossSwarmReadinessState;
  completionSatisfied: boolean;
  unresolvedConflictCount: number;
  activeInvestigationCount: number;
  linkedInvestigationIds: string[];
  linkedSynthesisIds: string[];
  protocolFamilies: string[];
  assetFamilies: string[];
  eventFamilies: string[];
  cohortFamilies: string[];
  subjectKeys: string[];
};

export type CrossSwarmLinkProjection = {
  crossSwarmId: string;
  displayName: string;
  groupType: string;
  enabled: boolean;
  linkedSwarmIds: string[];
  linkedSwarms: CrossSwarmLinkedSwarm[];
  rationale: string[];
};

function buildRationale(input: {
  dimension: CrossSwarmMatchDimension;
  values: string[];
}): CrossSwarmLinkRationale {
  return {
    dimension: input.dimension,
    reason: `${input.dimension}:${input.values.join(',')}`
  };
}

function requiredDimensionSatisfied(input: {
  dimension: CrossSwarmMatchDimension;
  context: SwarmContext;
  definition: ReturnType<CrossSwarmRegistry['getDefinition']>;
}): CrossSwarmLinkRationale | null {
  if (input.dimension === 'explicit_definition_match') {
    if (input.definition.include.swarmIds.includes(input.context.swarmId)) {
      return buildRationale({
        dimension: input.dimension,
        values: [input.context.swarmId]
      });
    }
    return null;
  }

  if (input.dimension === 'shared_team_ownership') {
    if (
      input.definition.scope.teamIds.includes(input.context.teamId)
      || input.definition.include.teamIds.includes(input.context.teamId)
    ) {
      return buildRationale({
        dimension: input.dimension,
        values: [input.context.teamId]
      });
    }
    return null;
  }

  if (input.dimension === 'shared_protocol_family') {
    const overlap = intersects(input.context.protocolFamilies, input.definition.include.protocolFamilies);
    return overlap.length > 0
      ? buildRationale({ dimension: input.dimension, values: overlap })
      : null;
  }

  if (input.dimension === 'shared_asset_family') {
    const overlap = intersects(input.context.assetFamilies, input.definition.include.assetFamilies);
    return overlap.length > 0
      ? buildRationale({ dimension: input.dimension, values: overlap })
      : null;
  }

  if (input.dimension === 'shared_event_family') {
    const overlap = intersects(input.context.eventFamilies, input.definition.include.eventFamilies);
    return overlap.length > 0
      ? buildRationale({ dimension: input.dimension, values: overlap })
      : null;
  }

  const overlap = intersects(input.context.cohortFamilies, input.definition.include.cohortFamilies);
  return overlap.length > 0
    ? buildRationale({ dimension: input.dimension, values: overlap })
    : null;
}

function passesScope(input: {
  context: SwarmContext;
  definition: ReturnType<CrossSwarmRegistry['getDefinition']>;
}): boolean {
  const { definition, context } = input;

  if (definition.scope.teamIds.length > 0 && !definition.scope.teamIds.includes(context.teamId)) {
    return false;
  }

  if (definition.scope.subjectKeys.length > 0 && intersects(context.subjectKeys, definition.scope.subjectKeys).length === 0) {
    return false;
  }

  return true;
}

function passesIncludeFilters(input: {
  context: SwarmContext;
  definition: ReturnType<CrossSwarmRegistry['getDefinition']>;
}): boolean {
  const { definition, context } = input;

  if (definition.include.swarmIds.length > 0 && !definition.include.swarmIds.includes(context.swarmId)) {
    return false;
  }
  if (definition.include.teamIds.length > 0 && !definition.include.teamIds.includes(context.teamId)) {
    return false;
  }
  if (definition.include.protocolFamilies.length > 0 && intersects(context.protocolFamilies, definition.include.protocolFamilies).length === 0) {
    return false;
  }
  if (definition.include.assetFamilies.length > 0 && intersects(context.assetFamilies, definition.include.assetFamilies).length === 0) {
    return false;
  }
  if (definition.include.eventFamilies.length > 0 && intersects(context.eventFamilies, definition.include.eventFamilies).length === 0) {
    return false;
  }
  if (definition.include.cohortFamilies.length > 0 && intersects(context.cohortFamilies, definition.include.cohortFamilies).length === 0) {
    return false;
  }

  return true;
}

export function createCrossSwarmLinker(options: {
  registry?: CrossSwarmRegistry;
  swarmRegistry?: SwarmRegistry;
  swarmInspection?: SwarmInspection;
  attachmentResolver?: ResearchTeamAttachmentResolver;
  cohortRegistry?: CohortRegistry;
  investigationInspection?: InvestigationInspection;
  signalStore?: SignalStore;
  definitionsDir?: string;
  swarmDefinitionsDir?: string;
  teamDefinitionsDir?: string;
  cohortDefinitionsDir?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  swarmArtifactsRoot?: string;
  cohortProgramDefinitionsDir?: string;
  policyDefinitionsDir?: string;
  coordinationArtifactsRoot?: string;
  teamSwarmArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const registry = options.registry ?? createCrossSwarmRegistry({ definitionsDir: options.definitionsDir });
  const swarmRegistry = options.swarmRegistry ?? createSwarmRegistry({ definitionsDir: options.swarmDefinitionsDir });
  const swarmInspection = options.swarmInspection ?? createSwarmInspection({
    definitionsDir: options.swarmDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    signalsRootDir: options.signalsRootDir,
    swarmArtifactsRoot: options.swarmArtifactsRoot
  });
  const cohortRegistry = options.cohortRegistry ?? createCohortRegistry({ definitionsDir: options.cohortDefinitionsDir });
  const attachmentResolver = options.attachmentResolver ?? createResearchTeamAttachmentResolver({
    teamDefinitionsDir: options.teamDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortRegistry
  });
  const investigationInspection = options.investigationInspection ?? createInvestigationInspection({
    definitionsDir: options.investigationDefinitionsDir,
    rootDir: options.investigationsRootDir,
    artifactsRoot: options.investigationArtifactsRoot
  });
  const signalStore = options.signalStore ?? createSignalStore({ rootDir: options.signalsRootDir });

  function buildSwarmContexts(): SwarmContext[] {
    return swarmRegistry
      .listSwarmDefinitions()
      .map((definition) => {
        const swarmProjection = swarmInspection.inspectSwarm(definition.swarmId);
        const attachments = attachmentResolver.resolveAttachmentsForTeam(definition.teamId);
        const linkedCohorts = attachments
          .map((attachment) => cohortRegistry.getCohortDefinition(attachment.cohortId));

        const investigations = [...swarmProjection.investigations].sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));
        const linkedInvestigationIds = investigations.map((entry) => entry.investigationRunId);
        const linkedSynthesisIds = swarmProjection.syntheses.map((entry) => entry.synthesisId).sort((left, right) => left.localeCompare(right));

        const protocolFamilies: string[] = linkedCohorts.map((cohort) => normalizeToken(cohort.subjectKey));
        const assetFamilies: string[] = [];
        const eventFamilies: string[] = [];

        for (const investigation of investigations) {
          eventFamilies.push(familyFromDashOrUnderscore(investigation.investigationDefinitionId));
          const inspected = investigationInspection.inspectInvestigation(investigation.investigationRunId);
          eventFamilies.push(familyFromDashOrUnderscore(inspected.record.sourceSignalType));

          const signal = signalStore.getSignalByDedupeKey(inspected.record.sourceSignalReference);
          const protocol = signal?.metadata.protocol;
          const asset = signal?.metadata.asset;
          if (typeof protocol === 'string' && protocol.trim().length > 0) {
            protocolFamilies.push(normalizeToken(protocol));
          }
          if (typeof asset === 'string' && asset.trim().length > 0) {
            assetFamilies.push(normalizeToken(asset));
          }
        }

        const cohortFamilies = linkedCohorts.map((cohort) => familyFromDashOrUnderscore(cohort.cohortType));
        const subjectKeys = linkedCohorts.map((cohort) => normalizeToken(cohort.subjectKey));

        return {
          swarmId: definition.swarmId,
          swarmDisplayName: definition.displayName,
          teamId: definition.teamId,
          lifecycleState: toCrossLifecycleState(swarmProjection.state),
          readinessState: toCrossReadinessState(swarmProjection.readiness.readiness),
          completionSatisfied: swarmProjection.completion.isComplete,
          unresolvedConflictCount: swarmProjection.completion.unresolvedConflictCount,
          activeInvestigationCount: investigations.filter((entry) => entry.status !== 'completed').length,
          linkedInvestigationIds,
          linkedSynthesisIds,
          protocolFamilies: uniqueSorted(protocolFamilies),
          assetFamilies: uniqueSorted(assetFamilies),
          eventFamilies: uniqueSorted([...eventFamilies, ...definition.investigationTemplates.map((entry) => familyFromDashOrUnderscore(entry)), familyFromDashOrUnderscore(definition.swarmId)]),
          cohortFamilies: uniqueSorted(cohortFamilies),
          subjectKeys: uniqueSorted(subjectKeys)
        } satisfies SwarmContext;
      })
      .sort((left, right) => left.swarmId.localeCompare(right.swarmId));
  }

  function buildLinks(): CrossSwarmLinkProjection[] {
    const contexts = buildSwarmContexts();

    return registry
      .listDefinitions()
      .map((definition) => {
        const linkedSwarms = contexts
          .map((context) => {
            if (!definition.enabled) {
              return null;
            }
            if (!passesScope({ context, definition })) {
              return null;
            }
            if (!passesIncludeFilters({ context, definition })) {
              return null;
            }

            const rationale = definition.requiredMatchDimensions
              .map((dimension) => requiredDimensionSatisfied({
                dimension,
                context,
                definition
              }))
              .filter((entry): entry is CrossSwarmLinkRationale => entry !== null)
              .sort((left, right) => {
                const dimensionCmp = left.dimension.localeCompare(right.dimension);
                if (dimensionCmp !== 0) {
                  return dimensionCmp;
                }
                return left.reason.localeCompare(right.reason);
              });

            if (rationale.length !== definition.requiredMatchDimensions.length) {
              return null;
            }

            return {
              crossSwarmId: definition.crossSwarmId,
              swarmId: context.swarmId,
              teamId: context.teamId,
              swarmDisplayName: context.swarmDisplayName,
              lifecycleState: context.lifecycleState,
              readinessState: context.readinessState,
              completionSatisfied: context.completionSatisfied,
              unresolvedConflictCount: context.unresolvedConflictCount,
              activeInvestigationCount: context.activeInvestigationCount,
              linkedInvestigationIds: context.linkedInvestigationIds,
              linkedSynthesisIds: context.linkedSynthesisIds,
              protocolFamilies: context.protocolFamilies,
              assetFamilies: context.assetFamilies,
              eventFamilies: context.eventFamilies,
              cohortFamilies: context.cohortFamilies,
              rationale
            } satisfies CrossSwarmLinkedSwarm;
          })
          .filter((entry): entry is CrossSwarmLinkedSwarm => entry !== null)
          .sort((left, right) => left.swarmId.localeCompare(right.swarmId));

        return {
          crossSwarmId: definition.crossSwarmId,
          displayName: definition.displayName,
          groupType: definition.groupType,
          enabled: definition.enabled,
          linkedSwarmIds: linkedSwarms.map((entry) => entry.swarmId).sort((left, right) => left.localeCompare(right)),
          linkedSwarms,
          rationale: uniqueSorted(linkedSwarms.flatMap((entry) => entry.rationale.map((reason) => `${entry.swarmId}:${reason.reason}`)))
        } satisfies CrossSwarmLinkProjection;
      })
      .sort((left, right) => left.crossSwarmId.localeCompare(right.crossSwarmId));
  }

  return {
    buildLinks
  };
}

export type CrossSwarmLinker = ReturnType<typeof createCrossSwarmLinker>;
