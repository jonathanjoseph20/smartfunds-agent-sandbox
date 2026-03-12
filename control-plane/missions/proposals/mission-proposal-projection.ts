import type { MissionProposalDefinition } from './mission-proposal-definition-types.ts';
import {
  createMissionProposalHistoryStore,
  resolveMissionProposalArtifactPaths,
  type MissionProposalHistoryStore,
} from './mission-proposal-history-store.ts';
import {
  createMissionProposalRegistry,
  type MissionProposalRegistry,
} from './mission-proposal-registry.ts';
import { evaluateMissionProposalStatus } from './mission-proposal-status.ts';
import type {
  MissionProposalHistoryEntry,
  MissionProposalProjection,
  MissionProposalStatus,
} from './mission-proposal-types.ts';

function buildStatusPreview(status: MissionProposalStatus): Record<string, unknown> {
  return {
    proposalId: status.proposalId,
    proposalState: status.proposalState,
    approvalState: status.approvalState,
    conversionState: status.conversionState,
    blockingReasons: status.blockingReasons,
    limitations: status.limitations,
  };
}

function findConversionPreview(historyEntries: MissionProposalHistoryEntry[]): Record<string, unknown> | undefined {
  const conversionEvent = [...historyEntries]
    .filter((entry) => [
      'proposal_converted_to_mission',
      'proposal_linked_existing_mission',
      'proposal_conversion_blocked',
      'proposal_conversion_attempted',
    ].includes(entry.eventType))
    .sort((left, right) => left.eventDedupeKey.localeCompare(right.eventDedupeKey))
    .at(-1);

  if (!conversionEvent) {
    return undefined;
  }

  return {
    eventType: conversionEvent.eventType,
    payload: conversionEvent.payload,
  };
}

function toProjection(input: {
  definition: MissionProposalDefinition;
  instance: Record<string, unknown>;
  linkedUpstreamObjects: {
    linkedMissionIds: string[];
    linkedDagIds: string[];
    linkedActionPlanIds: string[];
    linkedPortfolioIds: string[];
  };
  status: MissionProposalStatus;
  historyStore: MissionProposalHistoryStore;
  proposalId: string;
  artifactsRoot?: string;
}): MissionProposalProjection {
  const history = input.historyStore.load(input.proposalId);
  const artifactPaths = resolveMissionProposalArtifactPaths({
    proposalId: input.proposalId,
    rootDir: input.artifactsRoot,
  });

  return {
    proposalId: input.status.proposalId,
    proposalType: input.definition.proposalType,
    displayName: input.definition.displayName,
    instance: input.instance,
    status: input.status,
    historySummary: {
      totalEvents: history.entries.length,
      ...(history.entries[0] ? { lastEventType: history.entries[0].eventType } : {}),
    },
    linkedUpstreamObjects: input.linkedUpstreamObjects,
    artifactPaths,
    statusPreview: buildStatusPreview(input.status),
    reportPreview: {
      definition: input.definition,
      status: input.status,
      history,
    },
    ...(findConversionPreview(history.entries)
      ? { conversionPreview: findConversionPreview(history.entries) }
      : {}),
  };
}

export function createMissionProposalProjection(options: {
  registry?: MissionProposalRegistry;
  historyStore?: MissionProposalHistoryStore;
  definitionsDir?: string;
  instancesDir?: string;
  missionTemplateDefinitionsDir?: string;
  missionDefinitionsDir?: string;
  missionDagDefinitionsDir?: string;
  missionProposalArtifactsRoot?: string;
} = {}) {
  const registry = options.registry ?? createMissionProposalRegistry({
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
    missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
  });

  const historyStore = options.historyStore ?? createMissionProposalHistoryStore({
    artifactsRoot: options.missionProposalArtifactsRoot,
  });

  function projectOne(proposalId: string): MissionProposalProjection {
    const instance = registry.getProposalInstance(proposalId);
    const definition = registry.getProposalDefinition(instance.proposalType);
    const history = historyStore.load(proposalId);
    const status = evaluateMissionProposalStatus({
      proposalInstance: instance,
      historyEntries: history.entries,
      missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
      missionDagDefinitionsDir: options.missionDagDefinitionsDir,
    });

    const base = toProjection({
      definition,
      instance: instance as unknown as Record<string, unknown>,
      linkedUpstreamObjects: {
        linkedMissionIds: instance.linkedMissionIds,
        linkedDagIds: instance.linkedDagIds,
        linkedActionPlanIds: instance.linkedActionPlanIds,
        linkedPortfolioIds: instance.linkedPortfolioIds,
      },
      status,
      historyStore,
      proposalId,
      artifactsRoot: options.missionProposalArtifactsRoot,
    });

    return {
      ...base,
      proposalType: instance.proposalType,
      displayName: instance.displayName,
      reportPreview: {
        proposalId: instance.proposalId,
        proposalType: instance.proposalType,
        displayName: instance.displayName,
        definition,
        instance,
        status,
        history,
      },
    };
  }

  function projectAll(): MissionProposalProjection[] {
    return registry.listProposalInstances()
      .map((entry) => projectOne(entry.proposalId))
      .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
  }

  return {
    projectOne,
    projectAll,
  };
}

export type MissionProposalProjectionEngine = ReturnType<typeof createMissionProposalProjection>;
