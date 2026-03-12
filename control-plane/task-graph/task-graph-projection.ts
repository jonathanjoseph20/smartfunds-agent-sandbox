import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createTaskGraphEvaluator,
  type TaskGraphEvaluator,
} from './task-graph-evaluator.ts';
import {
  createTaskGraphHistoryStore,
  resolveTaskGraphArtifactPaths,
  type TaskGraphHistoryStore,
} from './task-graph-history-store.ts';
import { deriveTaskGraphStatus } from './task-graph-status.ts';
import type { MissionTaskGraphProjection } from './task-graph-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function computeHistoryDigest(entries: unknown[]): string {
  return sha256(canonicalStringify(entries));
}

function resolveSeedByTaskGraphId(input: {
  taskGraphId: string;
  historyStore: TaskGraphHistoryStore;
}): { executionEngineRunId: string } | null {
  const history = input.historyStore.loadByTaskGraphId({
    taskGraphId: input.taskGraphId,
  });

  if (!history || !history.executionEngineRunId) {
    return null;
  }

  return {
    executionEngineRunId: history.executionEngineRunId,
  };
}

export function createTaskGraphProjection(options: {
  evaluator?: TaskGraphEvaluator;
  historyStore?: TaskGraphHistoryStore;
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
} = {}) {
  const evaluator = options.evaluator ?? createTaskGraphEvaluator({
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

  const historyStore = options.historyStore ?? createTaskGraphHistoryStore({
    artifactsRoot: options.taskGraphArtifactsRoot,
  });

  function projectOne(input: {
    executionEngineRunId?: string;
    taskGraphId?: string;
  }): MissionTaskGraphProjection {
    let executionEngineRunId = input.executionEngineRunId;

    if (!executionEngineRunId && input.taskGraphId) {
      const seed = resolveSeedByTaskGraphId({
        taskGraphId: input.taskGraphId,
        historyStore,
      });

      if (seed) {
        executionEngineRunId = seed.executionEngineRunId;
      }
    }

    if (!executionEngineRunId) {
      throw new Error('TASK_GRAPH_NOT_FOUND');
    }

    const evaluated = evaluator.evaluateTaskGraph({ executionEngineRunId }).taskGraph;

    if (input.taskGraphId && input.taskGraphId !== evaluated.taskGraphId) {
      throw new Error('TASK_GRAPH_NOT_FOUND');
    }

    const history = historyStore.load({
      taskGraphId: evaluated.taskGraphId,
      executionEngineRunId: evaluated.executionEngineRunId,
      executionAttemptId: evaluated.executionAttemptId,
      runtimeEnvelopeId: evaluated.runtimeEnvelopeId,
      executionContractId: evaluated.executionContractId,
      missionId: evaluated.missionId,
    });

    const status = deriveTaskGraphStatus({
      taskNodes: evaluated.taskNodes,
      historyEntries: history.entries,
    });

    const historyDigest = computeHistoryDigest(history.entries);

    const artifactPaths = resolveTaskGraphArtifactPaths({
      taskGraphId: evaluated.taskGraphId,
      rootDir: options.taskGraphArtifactsRoot,
    });

    const statusPreview = {
      taskGraphId: evaluated.taskGraphId,
      executionEngineRunId: evaluated.executionEngineRunId,
      executionAttemptId: evaluated.executionAttemptId,
      runtimeEnvelopeId: evaluated.runtimeEnvelopeId,
      executionContractId: evaluated.executionContractId,
      missionId: evaluated.missionId,
      graphState: status.graphState,
      graphEligibilityState: status.graphEligibilityState,
      nodeCount: evaluated.nodeCount,
      edgeCount: evaluated.edgeCount,
      readyNodeCount: status.readyNodeCount,
      runningNodeCount: status.runningNodeCount,
      completedNodeCount: status.completedNodeCount,
      blockedNodeCount: status.blockedNodeCount,
      nodeStateCounts: status.nodeStateCounts,
      blockingReasons: uniqueSorted([
        ...evaluated.blockingReasons,
        ...status.blockingReasons,
      ]),
      limitations: uniqueSorted(evaluated.limitations),
      historyDigest,
    } as Record<string, unknown>;

    const reportPreview = {
      ...evaluated,
      graphState: status.graphState,
      graphEligibilityState: status.graphEligibilityState,
      nodeStateCounts: status.nodeStateCounts,
      readyNodeCount: status.readyNodeCount,
      runningNodeCount: status.runningNodeCount,
      completedNodeCount: status.completedNodeCount,
      blockedNodeCount: status.blockedNodeCount,
      history,
      historyDigest,
    } as Record<string, unknown>;

    return {
      ...evaluated,
      taskNodes: [...evaluated.taskNodes].sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId)),
      taskEdges: [...evaluated.taskEdges].sort((left, right) => {
        const bySource = left.sourceNodeId.localeCompare(right.sourceNodeId);
        if (bySource !== 0) {
          return bySource;
        }
        const byTarget = left.targetNodeId.localeCompare(right.targetNodeId);
        if (byTarget !== 0) {
          return byTarget;
        }
        return left.dependencyType.localeCompare(right.dependencyType);
      }),
      graphState: status.graphState,
      graphEligibilityState: status.graphEligibilityState,
      blockingReasons: uniqueSorted([
        ...evaluated.blockingReasons,
        ...status.blockingReasons,
      ]),
      limitations: uniqueSorted(evaluated.limitations),
      historySummary: {
        totalEvents: history.entries.length,
        ...(history.entries[history.entries.length - 1]
          ? { lastEventType: history.entries[history.entries.length - 1].eventType }
          : {}),
        ...(history.entries[history.entries.length - 1]
          ? { lastEventDedupeKey: history.entries[history.entries.length - 1].eventDedupeKey }
          : {}),
      },
      nodeStateCounts: status.nodeStateCounts,
      readyNodeCount: status.readyNodeCount,
      runningNodeCount: status.runningNodeCount,
      completedNodeCount: status.completedNodeCount,
      blockedNodeCount: status.blockedNodeCount,
      statusPreview,
      reportPreview,
      artifactPaths,
    };
  }

  function projectAll(): MissionTaskGraphProjection[] {
    return evaluator.evaluateAllTaskGraphs()
      .map((entry) => projectOne({
        executionEngineRunId: entry.taskGraph.executionEngineRunId,
      }))
      .sort((left, right) => left.taskGraphId.localeCompare(right.taskGraphId));
  }

  function summarizeList() {
    return projectAll()
      .map((entry) => ({
        taskGraphId: entry.taskGraphId,
        missionId: entry.missionId,
        nodeCount: entry.nodeCount,
        graphState: entry.graphState,
      }))
      .sort((left, right) => left.taskGraphId.localeCompare(right.taskGraphId));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type TaskGraphProjectionEngine = ReturnType<typeof createTaskGraphProjection>;
