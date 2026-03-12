import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionTaskEdge,
  MissionTaskNode,
  TaskEdgeDependencyType,
} from './task-graph-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(value)) as Record<string, unknown>;
}

function normalizeNodeShape(node: {
  taskType: string;
  taskName: string;
  taskDescription: string;
  taskInputs: Record<string, unknown>;
  taskOutputs: Record<string, unknown>;
  requiredCapabilities: string[];
  nodeKey?: string;
}) {
  return {
    taskType: node.taskType,
    taskName: node.taskName,
    taskDescription: node.taskDescription,
    taskInputs: normalizeRecord(node.taskInputs),
    taskOutputs: normalizeRecord(node.taskOutputs),
    requiredCapabilities: uniqueSorted(node.requiredCapabilities),
    ...(node.nodeKey ? { nodeKey: node.nodeKey } : {}),
  };
}

function normalizeEdgeShape(edge: {
  sourceNodeKey: string;
  targetNodeKey: string;
  dependencyType: TaskEdgeDependencyType;
}) {
  return {
    sourceNodeKey: edge.sourceNodeKey,
    targetNodeKey: edge.targetNodeKey,
    dependencyType: edge.dependencyType,
  };
}

export function normalizeTaskGraphStructure(input: {
  nodes: Array<{
    taskType: string;
    taskName: string;
    taskDescription: string;
    taskInputs: Record<string, unknown>;
    taskOutputs: Record<string, unknown>;
    requiredCapabilities: string[];
    nodeKey?: string;
  }>;
  edges: Array<{
    sourceNodeKey: string;
    targetNodeKey: string;
    dependencyType: TaskEdgeDependencyType;
  }>;
}) {
  const nodes = [...input.nodes]
    .map((node) => normalizeNodeShape(node))
    .sort((left, right) => {
      const byName = left.taskName.localeCompare(right.taskName);
      if (byName !== 0) {
        return byName;
      }
      const byType = left.taskType.localeCompare(right.taskType);
      if (byType !== 0) {
        return byType;
      }
      const byInputs = canonicalStringify(left.taskInputs).localeCompare(canonicalStringify(right.taskInputs));
      if (byInputs !== 0) {
        return byInputs;
      }
      return canonicalStringify(left).localeCompare(canonicalStringify(right));
    });

  const edges = [...input.edges]
    .map((edge) => normalizeEdgeShape(edge))
    .sort((left, right) => {
      const bySource = left.sourceNodeKey.localeCompare(right.sourceNodeKey);
      if (bySource !== 0) {
        return bySource;
      }
      const byTarget = left.targetNodeKey.localeCompare(right.targetNodeKey);
      if (byTarget !== 0) {
        return byTarget;
      }
      return left.dependencyType.localeCompare(right.dependencyType);
    });

  return { nodes, edges };
}

export function deriveTaskGraphId(input: {
  executionEngineRunId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  normalizedGraphStructure: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
}): string {
  return sha256(canonicalStringify({
    executionEngineRunId: input.executionEngineRunId,
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    normalizedGraphStructure: normalizeRecord(input.normalizedGraphStructure as unknown as Record<string, unknown>),
  }));
}

export function deriveTaskNodeId(input: {
  taskGraphId: string;
  taskType: string;
  taskName: string;
  taskInputs: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    taskGraphId: input.taskGraphId,
    taskType: input.taskType,
    taskName: input.taskName,
    normalizedInputs: normalizeRecord(input.taskInputs),
  }));
}

export function deriveTaskEdgeId(input: {
  taskGraphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  dependencyType: TaskEdgeDependencyType;
}): string {
  return sha256(canonicalStringify({
    taskGraphId: input.taskGraphId,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    dependencyType: input.dependencyType,
  }));
}

export function normalizeTaskNodes(nodes: MissionTaskNode[]): MissionTaskNode[] {
  return [...nodes].map((node) => ({
    ...node,
    taskInputs: normalizeRecord(node.taskInputs),
    taskOutputs: normalizeRecord(node.taskOutputs),
    requiredCapabilities: uniqueSorted(node.requiredCapabilities),
    blockingReasons: uniqueSorted(node.blockingReasons),
    limitations: uniqueSorted(node.limitations),
    provenanceInputs: normalizeRecord(node.provenanceInputs),
  })).sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId));
}

export function normalizeTaskEdges(edges: MissionTaskEdge[]): MissionTaskEdge[] {
  return [...edges].sort((left, right) => {
    const bySource = left.sourceNodeId.localeCompare(right.sourceNodeId);
    if (bySource !== 0) {
      return bySource;
    }
    const byTarget = left.targetNodeId.localeCompare(right.targetNodeId);
    if (byTarget !== 0) {
      return byTarget;
    }
    return left.dependencyType.localeCompare(right.dependencyType);
  });
}
