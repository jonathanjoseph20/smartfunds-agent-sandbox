import type { MissionDAGDefinition, MissionDAGEdge, MissionDAGNode } from './mission-dag-types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeNodes(value: unknown, sourceLabel: string): MissionDAGNode[] {
  if (!Array.isArray(value)) {
    throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} nodes must be an array.`);
  }

  const normalized = value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} nodes must contain objects.`);
    }

    const missionId = asTrimmedString(entry.missionId);
    if (!missionId) {
      throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} node missionId must be a non-empty string.`);
    }

    return { missionId };
  });

  const missionIds = normalized.map((entry) => entry.missionId);
  if (uniqueSorted(missionIds).length !== missionIds.length) {
    throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} nodes must be unique by missionId.`);
  }

  return normalized.sort((left, right) => left.missionId.localeCompare(right.missionId));
}

function normalizeEdges(value: unknown, sourceLabel: string): MissionDAGEdge[] {
  if (!Array.isArray(value)) {
    throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} edges must be an array.`);
  }

  const normalized = value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} edges must contain objects.`);
    }

    const parentMissionId = asTrimmedString(entry.parentMissionId);
    const childMissionId = asTrimmedString(entry.childMissionId);

    if (!parentMissionId || !childMissionId) {
      throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} edges require parentMissionId and childMissionId.`);
    }

    return {
      parentMissionId,
      childMissionId,
    };
  });

  const edgeKeys = normalized.map((entry) => `${entry.parentMissionId}->${entry.childMissionId}`);
  if (uniqueSorted(edgeKeys).length !== edgeKeys.length) {
    throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} edges must be unique.`);
  }

  return normalized.sort((left, right) => {
    const parentCmp = left.parentMissionId.localeCompare(right.parentMissionId);
    if (parentCmp !== 0) {
      return parentCmp;
    }
    return left.childMissionId.localeCompare(right.childMissionId);
  });
}

function normalizeTags(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error('MISSION_DAG_INVALID_SCHEMA: tags must be an array of non-empty strings.');
  }

  const normalized = value.map((entry) => asTrimmedString(entry));
  if (normalized.some((entry) => !entry)) {
    throw new Error('MISSION_DAG_INVALID_SCHEMA: tags must be an array of non-empty strings.');
  }

  return uniqueSorted(normalized as string[]);
}

function detectCycle(input: { nodes: MissionDAGNode[]; edges: MissionDAGEdge[] }): void {
  const nodeIds = input.nodes.map((entry) => entry.missionId);
  const inDegree = new Map<string, number>(nodeIds.map((nodeId) => [nodeId, 0]));
  const adjacency = new Map<string, string[]>(nodeIds.map((nodeId) => [nodeId, []]));

  for (const edge of input.edges) {
    const neighbors = adjacency.get(edge.parentMissionId) ?? [];
    neighbors.push(edge.childMissionId);
    neighbors.sort((left, right) => left.localeCompare(right));
    adjacency.set(edge.parentMissionId, neighbors);
    inDegree.set(edge.childMissionId, (inDegree.get(edge.childMissionId) ?? 0) + 1);
  }

  const queue = nodeIds
    .filter((nodeId) => (inDegree.get(nodeId) ?? 0) === 0)
    .sort((left, right) => left.localeCompare(right));

  const visited: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    visited.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const nextInDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, nextInDegree);
      if (nextInDegree === 0) {
        queue.push(neighbor);
        queue.sort((left, right) => left.localeCompare(right));
      }
    }
  }

  if (visited.length !== nodeIds.length) {
    const cycleNodes = nodeIds
      .filter((nodeId) => (inDegree.get(nodeId) ?? 0) > 0)
      .sort((left, right) => left.localeCompare(right));
    throw new Error(`MISSION_DAG_CYCLE_DETECTED: ${cycleNodes.join(',')}`);
  }
}

export function normalizeMissionDAGDefinition(value: unknown, sourceLabel = '<inline>'): Omit<MissionDAGDefinition, 'dagId'> {
  if (!isRecord(value)) {
    throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} definition must be an object.`);
  }

  const displayName = asTrimmedString(value.displayName);
  const description = asTrimmedString(value.description);
  const rootMissionId = asTrimmedString(value.rootMissionId);

  if (!displayName) {
    throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} displayName must be a non-empty string.`);
  }

  if (!rootMissionId) {
    throw new Error(`MISSION_DAG_INVALID_SCHEMA: ${sourceLabel} rootMissionId must be a non-empty string.`);
  }

  const nodes = normalizeNodes(value.nodes, sourceLabel);
  const edges = normalizeEdges(value.edges, sourceLabel);
  const tags = normalizeTags(value.tags);

  return {
    displayName,
    ...(description ? { description } : {}),
    rootMissionId,
    nodes,
    edges,
    ...(tags ? { tags } : {}),
  };
}

export function buildMissionDAGIdentityPayload(input: {
  rootMissionId: string;
  nodes: MissionDAGNode[];
  edges: MissionDAGEdge[];
}): {
  rootMissionId: string;
  nodes: MissionDAGNode[];
  edges: MissionDAGEdge[];
} {
  return {
    rootMissionId: input.rootMissionId.trim(),
    nodes: [...input.nodes]
      .map((entry) => ({ missionId: entry.missionId.trim() }))
      .sort((left, right) => left.missionId.localeCompare(right.missionId)),
    edges: [...input.edges]
      .map((entry) => ({
        parentMissionId: entry.parentMissionId.trim(),
        childMissionId: entry.childMissionId.trim(),
      }))
      .sort((left, right) => {
        const parentCmp = left.parentMissionId.localeCompare(right.parentMissionId);
        if (parentCmp !== 0) {
          return parentCmp;
        }
        return left.childMissionId.localeCompare(right.childMissionId);
      }),
  };
}

export function validateMissionDAGDefinition(input: {
  value: unknown;
  sourceLabel?: string;
  knownMissionIds: string[];
  dagId?: string;
  expectedDagId?: string;
}): Omit<MissionDAGDefinition, 'dagId'> {
  const sourceLabel = input.sourceLabel ?? '<inline>';
  const normalized = normalizeMissionDAGDefinition(input.value, sourceLabel);
  const knownMissionIds = new Set(uniqueSorted(input.knownMissionIds));

  const nodeMissionIds = new Set(normalized.nodes.map((entry) => entry.missionId));

  if (!nodeMissionIds.has(normalized.rootMissionId)) {
    throw new Error(`MISSION_DAG_INVALID_ROOT: ${sourceLabel} rootMissionId must exist in nodes.`);
  }

  if (!knownMissionIds.has(normalized.rootMissionId)) {
    throw new Error(`MISSION_DAG_UNKNOWN_ROOT_MISSION: ${normalized.rootMissionId}`);
  }

  const missingNodes = normalized.nodes
    .map((entry) => entry.missionId)
    .filter((missionId) => !knownMissionIds.has(missionId));

  if (missingNodes.length > 0) {
    throw new Error(`MISSION_DAG_UNKNOWN_MISSION_NODES: ${uniqueSorted(missingNodes).join(',')}`);
  }

  for (const edge of normalized.edges) {
    if (!nodeMissionIds.has(edge.parentMissionId) || !nodeMissionIds.has(edge.childMissionId)) {
      throw new Error(
        `MISSION_DAG_INVALID_EDGE_REFERENCE: ${edge.parentMissionId}->${edge.childMissionId}`
      );
    }
  }

  detectCycle({
    nodes: normalized.nodes,
    edges: normalized.edges,
  });

  if (input.expectedDagId && input.dagId && input.dagId !== input.expectedDagId) {
    throw new Error(`MISSION_DAG_INVALID_IDENTITY: expected ${input.expectedDagId} but received ${input.dagId}`);
  }

  return normalized;
}
