import type { MissionInstance } from '../mission-instance-types.ts';
import {
  createMissionRegistry,
  type MissionRegistry,
} from '../mission-registry.ts';

import {
  createMissionDAGHistoryStore,
  type MissionDAGHistoryStore,
} from './mission-dag-history-store.ts';
import {
  createMissionDAGRegistry,
  type MissionDAGRegistry,
} from './mission-dag-registry.ts';
import {
  evaluateMissionDAGStatus,
} from './mission-dag-status.ts';
import type { MissionDAGProjection, MissionDAGStatusProjection } from './mission-dag-types.ts';

function sortInstances(instances: MissionInstance[]): MissionInstance[] {
  return [...instances].sort((left, right) => left.missionId.localeCompare(right.missionId));
}

export function createMissionDAGProjection(options: {
  dagRegistry?: MissionDAGRegistry;
  missionRegistry?: MissionRegistry;
  historyStore?: MissionDAGHistoryStore;
  dagDefinitionsDir?: string;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionDAGArtifactsRoot?: string;
} = {}) {
  const missionRegistry = options.missionRegistry ?? createMissionRegistry({
    definitionsDir: options.missionDefinitionsDir,
    instancesDir: options.missionInstancesDir,
  });

  const dagRegistry = options.dagRegistry ?? createMissionDAGRegistry({
    definitionsDir: options.dagDefinitionsDir,
    missionRegistry,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
  });

  const historyStore = options.historyStore ?? createMissionDAGHistoryStore({
    artifactsRoot: options.missionDAGArtifactsRoot,
  });

  function projectOne(dagId: string): MissionDAGProjection {
    const definition = dagRegistry.getMissionDAGDefinition(dagId);
    const missionInstances = sortInstances(
      definition.nodes.map((node) => missionRegistry.getMissionInstance(node.missionId))
    );

    const statusProjection: MissionDAGStatusProjection = evaluateMissionDAGStatus({
      definition,
      missionInstances,
    });

    return {
      dagId: definition.dagId,
      rootMissionId: definition.rootMissionId,
      nodes: [...definition.nodes].sort((left, right) => left.missionId.localeCompare(right.missionId)),
      edges: [...definition.edges].sort((left, right) => {
        const parentCmp = left.parentMissionId.localeCompare(right.parentMissionId);
        if (parentCmp !== 0) {
          return parentCmp;
        }
        return left.childMissionId.localeCompare(right.childMissionId);
      }),
      nodeStates: statusProjection.nodeStates,
      blockedNodes: statusProjection.blockedNodes,
      readyNodes: statusProjection.readyNodes,
      completedNodes: statusProjection.completedNodes,
      incompleteNodes: statusProjection.incompleteNodes,
      dagStatus: statusProjection.dagStatus,
    };
  }

  function projectAll(): MissionDAGProjection[] {
    return dagRegistry.listMissionDAGDefinitions()
      .map((entry) => projectOne(entry.dagId))
      .sort((left, right) => left.dagId.localeCompare(right.dagId));
  }

  function getHistory(dagId: string) {
    dagRegistry.getMissionDAGDefinition(dagId);
    return historyStore.load(dagId);
  }

  return {
    projectOne,
    projectAll,
    getHistory,
  };
}

export type MissionDAGProjectionEngine = ReturnType<typeof createMissionDAGProjection>;
