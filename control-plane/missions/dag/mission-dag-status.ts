import type { MissionInstance } from '../mission-instance-types.ts';

import type {
  MissionDAGDefinition,
  MissionDAGNodeState,
  MissionDAGStatus,
  MissionDAGStatusProjection,
} from './mission-dag-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function buildParentMap(definition: MissionDAGDefinition): Map<string, string[]> {
  const parentByChild = new Map<string, string[]>(definition.nodes.map((entry) => [entry.missionId, []]));

  for (const edge of definition.edges) {
    const current = parentByChild.get(edge.childMissionId) ?? [];
    current.push(edge.parentMissionId);
    current.sort((left, right) => left.localeCompare(right));
    parentByChild.set(edge.childMissionId, current);
  }

  return parentByChild;
}

function topologicalOrder(definition: MissionDAGDefinition): string[] {
  const nodeIds = definition.nodes
    .map((entry) => entry.missionId)
    .sort((left, right) => left.localeCompare(right));

  const inDegree = new Map<string, number>(nodeIds.map((nodeId) => [nodeId, 0]));
  const adjacency = new Map<string, string[]>(nodeIds.map((nodeId) => [nodeId, []]));

  for (const edge of definition.edges) {
    const neighbors = adjacency.get(edge.parentMissionId) ?? [];
    neighbors.push(edge.childMissionId);
    neighbors.sort((left, right) => left.localeCompare(right));
    adjacency.set(edge.parentMissionId, neighbors);
    inDegree.set(edge.childMissionId, (inDegree.get(edge.childMissionId) ?? 0) + 1);
  }

  const available = nodeIds
    .filter((nodeId) => (inDegree.get(nodeId) ?? 0) === 0)
    .sort((left, right) => left.localeCompare(right));

  const ordered: string[] = [];
  while (available.length > 0) {
    const next = available.shift();
    if (!next) {
      break;
    }
    ordered.push(next);

    for (const neighbor of adjacency.get(next) ?? []) {
      const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        available.push(neighbor);
        available.sort((left, right) => left.localeCompare(right));
      }
    }
  }

  if (ordered.length !== nodeIds.length) {
    throw new Error(`MISSION_DAG_INVALID_TOPOLOGY: ${definition.dagId}`);
  }

  return ordered;
}

function evaluateIntrinsicState(instance: MissionInstance): MissionDAGStatus {
  if (instance.completionState === 'inconclusive' || instance.readinessState === 'inconclusive') {
    return 'INCONCLUSIVE';
  }

  if (instance.completionState === 'completed' || instance.lifecycleState === 'completed') {
    return 'COMPLETED';
  }

  if (
    instance.lifecycleState === 'blocked'
    || instance.readinessState === 'blocked'
    || instance.approvalState === 'rejected'
  ) {
    return 'BLOCKED';
  }

  if (instance.readinessState === 'ready') {
    return 'READY';
  }

  return 'INCOMPLETE';
}

function evaluateNodeState(input: {
  missionId: string;
  intrinsicState: MissionDAGStatus;
  parentMissionIds: string[];
  stateByMissionId: ReadonlyMap<string, MissionDAGStatus>;
}): MissionDAGStatus {
  if (input.intrinsicState === 'COMPLETED' || input.intrinsicState === 'BLOCKED' || input.intrinsicState === 'INCONCLUSIVE') {
    return input.intrinsicState;
  }

  const parentStates = input.parentMissionIds
    .map((missionId) => input.stateByMissionId.get(missionId) ?? 'INCONCLUSIVE');

  if (parentStates.some((state) => state === 'INCONCLUSIVE')) {
    return 'INCONCLUSIVE';
  }

  if (parentStates.some((state) => state === 'BLOCKED')) {
    return 'BLOCKED';
  }

  if (parentStates.every((state) => state === 'COMPLETED')) {
    return input.intrinsicState === 'READY' ? 'READY' : 'INCOMPLETE';
  }

  return 'INCOMPLETE';
}

export function evaluateNodeStates(input: {
  definition: MissionDAGDefinition;
  missionInstances: MissionInstance[];
}): MissionDAGNodeState[] {
  const missionById = new Map(input.missionInstances.map((entry) => [entry.missionId, entry]));
  const parentByChild = buildParentMap(input.definition);

  const intrinsicStateByMissionId = new Map<string, MissionDAGStatus>();
  for (const node of input.definition.nodes) {
    const instance = missionById.get(node.missionId);
    if (!instance) {
      intrinsicStateByMissionId.set(node.missionId, 'INCONCLUSIVE');
      continue;
    }
    intrinsicStateByMissionId.set(node.missionId, evaluateIntrinsicState(instance));
  }

  const orderedMissionIds = topologicalOrder(input.definition);

  const stateByMissionId = new Map<string, MissionDAGStatus>();
  for (const missionId of orderedMissionIds) {
    const intrinsicState = intrinsicStateByMissionId.get(missionId) ?? 'INCONCLUSIVE';
    const dependencyMissionIds = uniqueSorted(parentByChild.get(missionId) ?? []);

    stateByMissionId.set(missionId, evaluateNodeState({
      missionId,
      intrinsicState,
      parentMissionIds: dependencyMissionIds,
      stateByMissionId,
    }));
  }

  return orderedMissionIds.map((missionId) => ({
    missionId,
    state: stateByMissionId.get(missionId) ?? 'INCONCLUSIVE',
    dependencyMissionIds: uniqueSorted(parentByChild.get(missionId) ?? []),
  }));
}

export function getBlockedNodes(input: { nodeStates: MissionDAGNodeState[] }): string[] {
  return input.nodeStates
    .filter((entry) => entry.state === 'BLOCKED')
    .map((entry) => entry.missionId)
    .sort((left, right) => left.localeCompare(right));
}

export function getReadyNodes(input: { nodeStates: MissionDAGNodeState[] }): string[] {
  return input.nodeStates
    .filter((entry) => entry.state === 'READY')
    .map((entry) => entry.missionId)
    .sort((left, right) => left.localeCompare(right));
}

function resolveDAGStatus(nodeStates: MissionDAGNodeState[]): MissionDAGStatus {
  if (nodeStates.some((entry) => entry.state === 'INCONCLUSIVE')) {
    return 'INCONCLUSIVE';
  }

  if (nodeStates.length > 0 && nodeStates.every((entry) => entry.state === 'COMPLETED')) {
    return 'COMPLETED';
  }

  if (nodeStates.some((entry) => entry.state === 'BLOCKED')) {
    return 'BLOCKED';
  }

  if (nodeStates.some((entry) => entry.state === 'READY')) {
    return 'READY';
  }

  if (nodeStates.some((entry) => entry.state === 'INCOMPLETE')) {
    return 'INCOMPLETE';
  }

  return 'INCONCLUSIVE';
}

export function evaluateMissionDAGStatus(input: {
  definition: MissionDAGDefinition;
  missionInstances: MissionInstance[];
}): MissionDAGStatusProjection {
  const nodeStates = evaluateNodeStates(input);

  const completedNodes = nodeStates
    .filter((entry) => entry.state === 'COMPLETED')
    .map((entry) => entry.missionId)
    .sort((left, right) => left.localeCompare(right));

  const incompleteNodes = nodeStates
    .filter((entry) => entry.state === 'INCOMPLETE')
    .map((entry) => entry.missionId)
    .sort((left, right) => left.localeCompare(right));

  return {
    dagId: input.definition.dagId,
    rootMissionId: input.definition.rootMissionId,
    nodeStates,
    blockedNodes: getBlockedNodes({ nodeStates }),
    readyNodes: getReadyNodes({ nodeStates }),
    completedNodes,
    incompleteNodes,
    dagStatus: resolveDAGStatus(nodeStates),
  };
}
