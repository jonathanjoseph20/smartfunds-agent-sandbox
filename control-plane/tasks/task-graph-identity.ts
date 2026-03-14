import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  ImplementationTaskGraphEdge,
  ImplementationTaskGraphNode,
} from './task-graph-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(value)) as Record<string, unknown>;
}

export function normalizeImplementationTaskGraphStructure(input: {
  nodes: Array<{
    phaseKey: string;
    taskType: 'implementation_phase' | 'plan_completion';
    taskName: string;
    taskDescription: string;
    taskInputs: Record<string, unknown>;
    requiredCapabilities: string[];
  }>;
  edges: Array<{
    sourcePhaseKey: string;
    targetPhaseKey: string;
    dependencyType: 'finish_to_start';
  }>;
}) {
  const nodes = [...input.nodes]
    .map((node) => ({
      phaseKey: node.phaseKey,
      taskType: node.taskType,
      taskName: node.taskName,
      taskDescription: node.taskDescription,
      taskInputs: normalizeRecord(node.taskInputs),
      requiredCapabilities: uniqueSorted(node.requiredCapabilities),
    }))
    .sort((left, right) => {
      const byPhaseKey = left.phaseKey.localeCompare(right.phaseKey);
      if (byPhaseKey !== 0) {
        return byPhaseKey;
      }

      return canonicalStringify(left).localeCompare(canonicalStringify(right));
    });

  const edges = [...input.edges]
    .map((edge) => ({
      sourcePhaseKey: edge.sourcePhaseKey,
      targetPhaseKey: edge.targetPhaseKey,
      dependencyType: edge.dependencyType,
    }))
    .sort((left, right) => {
      const bySource = left.sourcePhaseKey.localeCompare(right.sourcePhaseKey);
      if (bySource !== 0) {
        return bySource;
      }

      const byTarget = left.targetPhaseKey.localeCompare(right.targetPhaseKey);
      if (byTarget !== 0) {
        return byTarget;
      }

      return left.dependencyType.localeCompare(right.dependencyType);
    });

  return { nodes, edges };
}

export function deriveImplementationTaskGraphId(input: {
  planId: string;
  specId: string;
  architectureSummary: string;
  testStrategy: string;
  normalizedGraphStructure: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
}): string {
  return sha256(canonicalStringify({
    planId: input.planId,
    specId: input.specId,
    architectureSummary: input.architectureSummary,
    testStrategy: input.testStrategy,
    normalizedGraphStructure: normalizeRecord(input.normalizedGraphStructure as unknown as Record<string, unknown>),
  }));
}

export function deriveImplementationTaskNodeId(input: {
  taskGraphId: string;
  phaseKey: string;
  taskType: 'implementation_phase' | 'plan_completion';
  taskInputs: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    taskGraphId: input.taskGraphId,
    phaseKey: input.phaseKey,
    taskType: input.taskType,
    taskInputs: normalizeRecord(input.taskInputs),
  }));
}

export function deriveImplementationTaskEdgeId(input: {
  taskGraphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  dependencyType: 'finish_to_start';
}): string {
  return sha256(canonicalStringify({
    taskGraphId: input.taskGraphId,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    dependencyType: input.dependencyType,
  }));
}

export function normalizeImplementationTaskNodes(nodes: ImplementationTaskGraphNode[]): ImplementationTaskGraphNode[] {
  return [...nodes].map((node) => ({
    ...node,
    taskInputs: normalizeRecord(node.taskInputs),
    requiredCapabilities: uniqueSorted(node.requiredCapabilities),
  })).sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId));
}

export function normalizeImplementationTaskEdges(edges: ImplementationTaskGraphEdge[]): ImplementationTaskGraphEdge[] {
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
