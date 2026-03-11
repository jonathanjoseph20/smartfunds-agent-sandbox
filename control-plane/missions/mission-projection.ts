import type { MissionDefinition } from './mission-definition-types.ts';
import type { MissionInstance } from './mission-instance-types.ts';
import {
  createMissionHistoryStore,
  resolveMissionArtifactPaths,
  type MissionHistoryStore,
} from './mission-history-store.ts';
import {
  createMissionRegistry,
  type MissionRegistry,
} from './mission-registry.ts';
import { evaluateMissionStatus } from './mission-status.ts';
import type { MissionProjection, MissionStatus } from './mission-types.ts';

function summarizeDeliverables(instance: MissionInstance): MissionProjection['deliverableSummary'] {
  const totalRequested = instance.requestedDeliverables.length;
  const satisfied = instance.requestedDeliverables.filter((entry) => entry.satisfied === true).length;
  const pending = totalRequested - satisfied;

  return {
    totalRequested,
    satisfied,
    pending,
  };
}

function buildStatusPreview(status: MissionStatus): Record<string, unknown> {
  return {
    missionId: status.missionId,
    approvalState: status.approvalState,
    lifecycleState: status.lifecycleState,
    readinessState: status.readinessState,
    completionState: status.completionState,
    blockingReasons: status.blockingReasons,
    limitations: status.limitations,
  };
}

function toProjection(input: {
  definition: MissionDefinition;
  instance: MissionInstance;
  status: MissionStatus;
  historyStore: MissionHistoryStore;
  artifactsRoot?: string;
}): MissionProjection {
  const history = input.historyStore.load(input.instance.missionId);
  const artifactPaths = resolveMissionArtifactPaths({
    missionId: input.instance.missionId,
    rootDir: input.artifactsRoot,
  });

  const reportPreview = {
    missionId: input.instance.missionId,
    missionType: input.instance.missionType,
    displayName: input.instance.displayName,
    definition: input.definition,
    instance: input.instance,
    status: input.status,
    history,
    deliverableSummary: summarizeDeliverables(input.instance),
  } as Record<string, unknown>;

  return {
    missionId: input.instance.missionId,
    missionType: input.instance.missionType,
    displayName: input.instance.displayName,
    definition: input.definition as unknown as Record<string, unknown>,
    instance: input.instance as unknown as Record<string, unknown>,
    status: input.status,
    historySummary: {
      totalEvents: history.entries.length,
      ...(history.entries[0] ? { lastEventType: history.entries[0].eventType } : {}),
    },
    deliverableSummary: summarizeDeliverables(input.instance),
    linkedUpstreamObjects: {
      linkedActionPlanIds: input.instance.linkedActionPlanIds,
      linkedPortfolioIds: input.instance.linkedPortfolioIds,
      linkedMarketSynthesisIds: input.instance.linkedMarketSynthesisIds,
    },
    artifactPaths,
    statusPreview: buildStatusPreview(input.status),
    reportPreview,
  };
}

export function createMissionProjection(options: {
  registry?: MissionRegistry;
  historyStore?: MissionHistoryStore;
  definitionsDir?: string;
  instancesDir?: string;
  missionArtifactsRoot?: string;
} = {}) {
  const registry = options.registry ?? createMissionRegistry({
    definitionsDir: options.definitionsDir,
    instancesDir: options.instancesDir,
  });

  const historyStore = options.historyStore ?? createMissionHistoryStore({
    artifactsRoot: options.missionArtifactsRoot,
  });

  function projectOne(missionId: string): MissionProjection {
    const instance = registry.getMissionInstance(missionId);
    const definition = registry.getMissionDefinition(instance.missionType);
    const history = historyStore.load(missionId);

    const status = evaluateMissionStatus({
      missionInstance: instance,
      historyEntries: history.entries,
    });

    return toProjection({
      definition,
      instance,
      status,
      historyStore,
      artifactsRoot: options.missionArtifactsRoot,
    });
  }

  function projectAll(): MissionProjection[] {
    return registry.listMissionInstances()
      .map((entry) => projectOne(entry.missionId))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  return {
    projectOne,
    projectAll,
  };
}

export type MissionProjectionEngine = ReturnType<typeof createMissionProjection>;
