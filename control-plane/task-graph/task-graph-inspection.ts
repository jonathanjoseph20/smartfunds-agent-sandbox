import {
  createTaskGraphEvaluator,
  type TaskGraphEvaluator,
} from './task-graph-evaluator.ts';
import {
  createTaskGraphHistoryStore,
  type TaskGraphHistoryStore,
} from './task-graph-history-store.ts';
import {
  createTaskGraphMaterializer,
  type TaskGraphMaterializer,
} from './task-graph-materializer.ts';
import {
  createTaskGraphProjection,
  type TaskGraphProjectionEngine,
} from './task-graph-projection.ts';

export function createTaskGraphInspection(options: {
  evaluator?: TaskGraphEvaluator;
  projection?: TaskGraphProjectionEngine;
  historyStore?: TaskGraphHistoryStore;
  materializer?: TaskGraphMaterializer;
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

  const projection = options.projection ?? createTaskGraphProjection({
    evaluator,
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
  });

  const materializer = options.materializer ?? createTaskGraphMaterializer({
    projection,
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
  });

  function evaluateTaskGraph(input: { executionEngineRunId: string }) {
    evaluator.evaluateTaskGraph(input);
    return projection.projectOne({ executionEngineRunId: input.executionEngineRunId });
  }

  function listTaskGraphs() {
    return projection.summarizeList();
  }

  function inspectTaskGraph(input: { taskGraphId: string }) {
    return projection.projectOne(input);
  }

  function inspectTaskNode(input: { taskNodeId: string }) {
    for (const graph of projection.projectAll()) {
      const node = graph.taskNodes.find((entry) => entry.taskNodeId === input.taskNodeId);
      if (node) {
        return node;
      }
    }

    throw new Error('TASK_NODE_NOT_FOUND');
  }

  function listReadyNodes(input: { taskGraphId: string }) {
    return projection.projectOne(input).taskNodes
      .filter((node) => node.taskState === 'ready')
      .sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId));
  }

  function listBlockedNodes(input: { taskGraphId: string }) {
    return projection.projectOne(input).taskNodes
      .filter((node) => node.taskState === 'blocked' || node.taskState === 'failed')
      .sort((left, right) => left.taskNodeId.localeCompare(right.taskNodeId));
  }

  function taskGraphStatus(input: { taskGraphId: string }) {
    return projection.projectOne(input).statusPreview;
  }

  function taskGraphHistory(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    return historyStore.load({
      taskGraphId: projected.taskGraphId,
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
    });
  }

  function materializeTaskGraph(input: { taskGraphId: string }) {
    return materializer.materializeOne(input);
  }

  return {
    evaluateTaskGraph,
    listTaskGraphs,
    inspectTaskGraph,
    inspectTaskNode,
    listReadyNodes,
    listBlockedNodes,
    taskGraphStatus,
    taskGraphHistory,
    materializeTaskGraph,
  };
}

export type TaskGraphInspection = ReturnType<typeof createTaskGraphInspection>;
