import { createTaskGraphProjection, type TaskGraphProjectionEngine } from '../task-graph/task-graph-projection.ts';
import {
  loadWorkerRegistry,
  type WorkerRegistry,
} from '../workers/worker-registry.ts';

import { createTaskExecutionHistoryStore, type TaskExecutionHistoryStore } from './task-execution-history-store.ts';
import { createTaskExecutionProjection, type TaskExecutionProjectionEngine } from './task-execution-projection.ts';
import { DEFAULT_TASK_CONCURRENCY_POLICY_ID, getTaskConcurrencyPolicy } from './task-concurrency-policies.ts';
import { evaluateRunnableNodeSet } from './task-runnable-node-set.ts';
import type { MissionTaskExecutionProjection } from './task-execution-step-types.ts';

export interface TaskWorkerCandidate {
  executionRunId: string;
  taskNodeId: string;
  taskType: string;
  requiredCapabilities: string[];
  attemptIndex: number;
}

function buildDependencyDepths(input: {
  taskEdges: Array<{ sourceNodeId: string; targetNodeId: string; dependencyType: string }>;
  nodeIds: string[];
}): Record<string, number> {
  const predecessors = new Map<string, string[]>();
  for (const nodeId of [...input.nodeIds].sort((left, right) => left.localeCompare(right))) {
    predecessors.set(nodeId, []);
  }

  for (const edge of [...input.taskEdges].sort((left, right) => {
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
    predecessors.set(edge.targetNodeId, current.sort((left, right) => left.localeCompare(right)));
  }

  const depthCache = new Map<string, number>();

  function resolveDepth(nodeId: string, trail: Set<string>): number {
    const cached = depthCache.get(nodeId);
    if (cached !== undefined) {
      return cached;
    }

    if (trail.has(nodeId)) {
      return Number.MAX_SAFE_INTEGER;
    }

    trail.add(nodeId);
    const inputs = predecessors.get(nodeId) ?? [];
    if (inputs.length === 0) {
      depthCache.set(nodeId, 0);
      trail.delete(nodeId);
      return 0;
    }

    const depth = Math.max(...inputs.map((predecessorId) => resolveDepth(predecessorId, trail))) + 1;
    depthCache.set(nodeId, depth);
    trail.delete(nodeId);
    return depth;
  }

  for (const nodeId of [...input.nodeIds].sort((left, right) => left.localeCompare(right))) {
    resolveDepth(nodeId, new Set<string>());
  }

  return Object.fromEntries([...depthCache.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function latestAttemptByNode(projection: MissionTaskExecutionProjection): Record<string, number> {
  const latest = new Map<string, number>();
  for (const attempt of [...projection.retryAttempts].sort((left, right) => {
    const byNode = left.taskNodeId.localeCompare(right.taskNodeId);
    if (byNode !== 0) {
      return byNode;
    }

    return left.attemptIndex - right.attemptIndex;
  })) {
    latest.set(attempt.taskNodeId, attempt.attemptIndex);
  }

  return Object.fromEntries([...latest.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function createTaskWorkerDispatcher(options: {
  projection?: TaskExecutionProjectionEngine;
  historyStore?: TaskExecutionHistoryStore;
  taskGraphProjection?: TaskGraphProjectionEngine;
  workerRegistry?: WorkerRegistry;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
  executionAttemptArtifactsRoot?: string;
  executionJournalArtifactsRoot?: string;
  executionEngineArtifactsRoot?: string;
  taskGraphArtifactsRoot?: string;
  taskExecutionArtifactsRoot?: string;
  workerDefinitionsDir?: string;
} = {}) {
  const historyStore = options.historyStore ?? createTaskExecutionHistoryStore({
    artifactsRoot: options.taskExecutionArtifactsRoot,
  });

  const taskGraphProjection = options.taskGraphProjection ?? createTaskGraphProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
  });

  const projection = options.projection ?? createTaskExecutionProjection({
    taskGraphProjection,
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
  });

  const workerRegistry = options.workerRegistry ?? loadWorkerRegistry({
    definitionsDir: options.workerDefinitionsDir,
  });

  function discoverWork(input: { taskGraphId: string; workerId: string }): TaskWorkerCandidate[] {
    const taskGraph = taskGraphProjection.projectOne({ taskGraphId: input.taskGraphId });
    const projected = projection.projectOne({ taskGraphId: input.taskGraphId });
    const history = historyStore.load({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
    });

    const policy = getTaskConcurrencyPolicy(DEFAULT_TASK_CONCURRENCY_POLICY_ID);
    const runnableSet = evaluateRunnableNodeSet(taskGraph, projected, history, policy);

    const nodeById = new Map(
      [...taskGraph.taskNodes]
        .sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId))
        .map((node) => [node.taskNodeId, node]),
    );

    const attemptByNode = latestAttemptByNode(projected);
    const depthByNode = buildDependencyDepths({
      taskEdges: taskGraph.taskEdges,
      nodeIds: [...nodeById.keys()],
    });

    const compatible = runnableSet.runnableNodeIds
      .map((taskNodeId) => {
        const node = nodeById.get(taskNodeId);
        if (!node) {
          return null;
        }

        if (!workerRegistry.validateWorkerSupportsTask(input.workerId, node.taskType)) {
          return null;
        }

        if (!workerRegistry.validateWorkerCapabilities(input.workerId, node.requiredCapabilities)) {
          return null;
        }

        return {
          taskNodeId,
          taskType: node.taskType,
          requiredCapabilities: [...node.requiredCapabilities].sort((left, right) => left.localeCompare(right)),
          attemptIndex: attemptByNode[taskNodeId] ?? 0,
          dependencyReadiness: depthByNode[taskNodeId] ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((left, right) => {
        const byRetryPriority = Number(right.attemptIndex > 0) - Number(left.attemptIndex > 0);
        if (byRetryPriority !== 0) {
          return byRetryPriority;
        }

        const byDependencyReadiness = left.dependencyReadiness - right.dependencyReadiness;
        if (byDependencyReadiness !== 0) {
          return byDependencyReadiness;
        }

        return left.taskNodeId.localeCompare(right.taskNodeId);
      });

    return compatible.map((candidate) => ({
      executionRunId: projected.executionEngineRunId,
      taskNodeId: candidate.taskNodeId,
      taskType: candidate.taskType,
      requiredCapabilities: candidate.requiredCapabilities,
      attemptIndex: candidate.attemptIndex,
    }));
  }

  return {
    discoverWork,
  };
}

export type TaskWorkerDispatcher = ReturnType<typeof createTaskWorkerDispatcher>;
