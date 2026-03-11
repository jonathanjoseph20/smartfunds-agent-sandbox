import {
  createMissionRegistry,
  type MissionRegistry,
} from '../mission-registry.ts';

import {
  createMissionDAGHistoryStore,
  type MissionDAGHistoryStore,
} from './mission-dag-history-store.ts';
import {
  createMissionDAGMaterializer,
  type MissionDAGMaterializer,
} from './mission-dag-materializer.ts';
import {
  createMissionDAGProjection,
  type MissionDAGProjectionEngine,
} from './mission-dag-projection.ts';
import {
  createMissionDAGRegistry,
  type MissionDAGRegistry,
} from './mission-dag-registry.ts';

function buildTree(input: {
  dagId: string;
  rootMissionId: string;
  edges: Array<{ parentMissionId: string; childMissionId: string }>;
}) {
  const childrenByParent = new Map<string, string[]>();

  for (const edge of input.edges) {
    const current = childrenByParent.get(edge.parentMissionId) ?? [];
    current.push(edge.childMissionId);
    current.sort((left, right) => left.localeCompare(right));
    childrenByParent.set(edge.parentMissionId, current);
  }

  function walk(missionId: string, visited: Set<string>): Record<string, unknown> {
    if (visited.has(missionId)) {
      return {
        missionId,
        cycleReference: true,
      };
    }

    const nextVisited = new Set(visited);
    nextVisited.add(missionId);

    const children = (childrenByParent.get(missionId) ?? []).map((childMissionId) => walk(childMissionId, nextVisited));
    return {
      missionId,
      children,
    };
  }

  return {
    dagId: input.dagId,
    rootMissionId: input.rootMissionId,
    tree: walk(input.rootMissionId, new Set<string>()),
  };
}

export function createMissionDAGInspection(options: {
  dagRegistry?: MissionDAGRegistry;
  missionRegistry?: MissionRegistry;
  projection?: MissionDAGProjectionEngine;
  historyStore?: MissionDAGHistoryStore;
  materializer?: MissionDAGMaterializer;
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

  const projection = options.projection ?? createMissionDAGProjection({
    dagRegistry,
    missionRegistry,
    historyStore,
    dagDefinitionsDir: options.dagDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionDAGArtifactsRoot: options.missionDAGArtifactsRoot,
  });

  const materializer = options.materializer ?? createMissionDAGMaterializer({
    dagRegistry,
    missionRegistry,
    projection,
    historyStore,
    dagDefinitionsDir: options.dagDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionDAGArtifactsRoot: options.missionDAGArtifactsRoot,
  });

  function getMissionDAG(dagId: string) {
    return projection.projectOne(dagId);
  }

  function listMissionDAGs() {
    return dagRegistry.listMissionDAGDefinitions()
      .map((entry) => ({
        dagId: entry.dagId,
        displayName: entry.displayName,
        rootMissionId: entry.rootMissionId,
        nodeCount: entry.nodes.length,
        edgeCount: entry.edges.length,
      }))
      .sort((left, right) => left.dagId.localeCompare(right.dagId));
  }

  function getMissionTree(dagId: string) {
    const definition = dagRegistry.getMissionDAGDefinition(dagId);
    return buildTree({
      dagId: definition.dagId,
      rootMissionId: definition.rootMissionId,
      edges: definition.edges,
    });
  }

  function getBlockedNodes(dagId: string) {
    return projection.projectOne(dagId).blockedNodes;
  }

  function getReadyNodes(dagId: string) {
    return projection.projectOne(dagId).readyNodes;
  }

  function getMissionDAGStatus(dagId: string) {
    const projected = projection.projectOne(dagId);
    return {
      dagId: projected.dagId,
      rootMissionId: projected.rootMissionId,
      nodeStates: projected.nodeStates,
      blockedNodes: projected.blockedNodes,
      readyNodes: projected.readyNodes,
      completedNodes: projected.completedNodes,
      incompleteNodes: projected.incompleteNodes,
      dagStatus: projected.dagStatus,
    };
  }

  function getMissionDAGHistory(dagId: string) {
    dagRegistry.getMissionDAGDefinition(dagId);
    return historyStore.load(dagId);
  }

  function materializeMissionDAG(dagId: string) {
    return materializer.materializeOne(dagId);
  }

  return {
    getMissionDAG,
    listMissionDAGs,
    getMissionTree,
    getBlockedNodes,
    getReadyNodes,
    getMissionDAGStatus,
    getMissionDAGHistory,
    materializeMissionDAG,
  };
}

export type MissionDAGInspection = ReturnType<typeof createMissionDAGInspection>;
