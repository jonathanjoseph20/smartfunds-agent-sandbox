import type { MissionTaskExecutionHistory } from './task-execution-step-types.ts';
import type { MissionTaskExecutionProjection } from './task-execution-step-types.ts';
import type { MissionTaskGraph } from '../task-graph/task-graph-types.ts';

import type { TaskConcurrencyPolicy } from './task-concurrency-policy-types.ts';

export type RunnableNodeSet = {
  executionEngineRunId: string;
  runnableNodeIds: string[];
  runnableNodeCount: number;
  excludedNodes: {
    blocked: string[];
    retryWaiting: string[];
    alreadyRunning: string[];
  };
};

type Candidate = {
  nodeId: string;
  depth: number;
  retryRank: number;
  attemptIndex: number;
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function buildPredecessors(taskGraph: MissionTaskGraph): Map<string, string[]> {
  const predecessors = new Map<string, string[]>();

  for (const node of [...taskGraph.taskNodes].sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))) {
    predecessors.set(node.taskNodeId, []);
  }

  for (const edge of [...taskGraph.taskEdges].sort((left, right) => {
    const bySource = left.sourceNodeId.localeCompare(right.sourceNodeId);
    if (bySource !== 0) {
      return bySource;
    }

    const byTarget = left.targetNodeId.localeCompare(right.targetNodeId);
    if (byTarget !== 0) {
      return byTarget;
    }

    return left.dependencyType.localeCompare(right.dependencyType);
  })) {
    if (edge.dependencyType !== 'finish_to_start') {
      continue;
    }

    const current = predecessors.get(edge.targetNodeId) ?? [];
    current.push(edge.sourceNodeId);
    current.sort((left, right) => left.localeCompare(right));
    predecessors.set(edge.targetNodeId, current);
  }

  return predecessors;
}

function deriveDependencyDepths(taskGraph: MissionTaskGraph): Record<string, number> {
  const predecessors = buildPredecessors(taskGraph);
  const cache = new Map<string, number>();

  function resolveDepth(nodeId: string, trail: Set<string>): number {
    if (cache.has(nodeId)) {
      return cache.get(nodeId) ?? 0;
    }

    if (trail.has(nodeId)) {
      throw new Error('TASK_EXECUTION_STEP_INVALID');
    }

    trail.add(nodeId);
    const inputs = predecessors.get(nodeId) ?? [];
    if (inputs.length === 0) {
      cache.set(nodeId, 0);
      trail.delete(nodeId);
      return 0;
    }

    const depth = Math.max(...inputs.map((parentId) => resolveDepth(parentId, trail))) + 1;
    cache.set(nodeId, depth);
    trail.delete(nodeId);
    return depth;
  }

  for (const node of [...taskGraph.taskNodes].sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))) {
    resolveDepth(node.taskNodeId, new Set<string>());
  }

  return Object.fromEntries(
    [...cache.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function retryAttemptIndexByNode(projection: MissionTaskExecutionProjection): Record<string, number> {
  const latest = new Map<string, number>();

  for (const entry of [...projection.retryAttempts].sort((left, right) => {
    const byNode = left.taskNodeId.localeCompare(right.taskNodeId);
    if (byNode !== 0) {
      return byNode;
    }

    return left.attemptIndex - right.attemptIndex;
  })) {
    latest.set(entry.taskNodeId, entry.attemptIndex);
  }

  return Object.fromEntries(
    [...latest.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function retryRankForNode(input: {
  nodeId: string;
  attemptIndex: number;
  policy: TaskConcurrencyPolicy;
}): number {
  const isRetry = input.attemptIndex > 0;

  if (input.policy.retryPriorityMode === 'stable_mixed') {
    return 0;
  }

  if (input.policy.retryPriorityMode === 'before_fresh_ready') {
    return isRetry ? 0 : 1;
  }

  return isRetry ? 1 : 0;
}

function compareCandidates(left: Candidate, right: Candidate): number {
  const byDepth = left.depth - right.depth;
  if (byDepth !== 0) {
    return byDepth;
  }

  const byRetry = left.retryRank - right.retryRank;
  if (byRetry !== 0) {
    return byRetry;
  }

  const byAttempt = left.attemptIndex - right.attemptIndex;
  if (byAttempt !== 0) {
    return byAttempt;
  }

  return left.nodeId.localeCompare(right.nodeId);
}

export function evaluateRunnableNodeSet(
  graph: MissionTaskGraph,
  projection: MissionTaskExecutionProjection,
  _history: MissionTaskExecutionHistory,
  policy: TaskConcurrencyPolicy,
): RunnableNodeSet {
  const depths = deriveDependencyDepths(graph);
  const attemptIndexByNode = retryAttemptIndexByNode(projection);

  const blocked: string[] = [];
  const retryWaiting: string[] = [];
  const alreadyRunning: string[] = [];
  const candidates: Candidate[] = [];

  for (const nodeId of Object.keys(projection.nodeStates).sort((left, right) => left.localeCompare(right))) {
    const state = projection.nodeStates[nodeId];

    if (state === 'blocked' || state === 'failed' || state === 'permanently_failed') {
      blocked.push(nodeId);
      continue;
    }

    if (state === 'running') {
      alreadyRunning.push(nodeId);
      continue;
    }

    if (state === 'retrying') {
      retryWaiting.push(nodeId);
      continue;
    }

    if (state === 'completed' || state === 'skipped') {
      continue;
    }

    if (state !== 'ready') {
      continue;
    }

    const attemptIndex = attemptIndexByNode[nodeId] ?? 0;
    candidates.push({
      nodeId,
      depth: depths[nodeId] ?? Number.MAX_SAFE_INTEGER,
      retryRank: retryRankForNode({
        nodeId,
        attemptIndex,
        policy,
      }),
      attemptIndex,
    });
  }

  const ordered = [...candidates].sort(compareCandidates);
  const constrained = policy.sameLevelParallelismAllowed
    ? ordered
    : ordered.filter((candidate) => candidate.depth === (ordered[0]?.depth ?? 0));

  const runnableNodeIds = constrained.map((candidate) => candidate.nodeId);

  return {
    executionEngineRunId: projection.executionEngineRunId,
    runnableNodeIds,
    runnableNodeCount: runnableNodeIds.length,
    excludedNodes: {
      blocked: uniqueSorted(blocked),
      retryWaiting: uniqueSorted(retryWaiting),
      alreadyRunning: uniqueSorted(alreadyRunning),
    },
  };
}
