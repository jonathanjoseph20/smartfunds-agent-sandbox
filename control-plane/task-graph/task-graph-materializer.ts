import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createTaskGraphHistoryStore,
  ensureTaskGraphArtifactDir,
  resolveTaskGraphArtifactPaths,
  type TaskGraphHistoryStore,
} from './task-graph-history-store.ts';
import {
  createTaskGraphProjection,
  type TaskGraphProjectionEngine,
} from './task-graph-projection.ts';
import type { MissionTaskGraphMaterializationSummary } from './task-graph-types.ts';

function toMarkdownReport(input: {
  taskGraphId: string;
  executionEngineRunId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  graphState: string;
  graphEligibilityState: string;
  nodeCount: number;
  edgeCount: number;
  readyNodeCount: number;
  runningNodeCount: number;
  completedNodeCount: number;
  blockedNodeCount: number;
  blockingReasons: string[];
  limitations: string[];
}): string {
  const lines = [
    '# Mission Task Graph Report',
    '',
    `Task Graph: ${input.taskGraphId}`,
    `Execution Engine Run: ${input.executionEngineRunId}`,
    `Execution Attempt: ${input.executionAttemptId}`,
    `Runtime Envelope: ${input.runtimeEnvelopeId}`,
    `Execution Contract: ${input.executionContractId}`,
    `Mission: ${input.missionId}`,
    `Graph State: ${input.graphState}`,
    `Graph Eligibility State: ${input.graphEligibilityState}`,
    '',
    '## Counts',
    `- nodes: ${String(input.nodeCount)}`,
    `- edges: ${String(input.edgeCount)}`,
    `- readyNodeCount: ${String(input.readyNodeCount)}`,
    `- runningNodeCount: ${String(input.runningNodeCount)}`,
    `- completedNodeCount: ${String(input.completedNodeCount)}`,
    `- blockedNodeCount: ${String(input.blockedNodeCount)}`,
    '',
    '## Summary',
    `- blockingReasons: ${input.blockingReasons.join(', ') || 'none'}`,
    `- limitations: ${input.limitations.join(', ') || 'none'}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify({
      taskGraphId: input.taskGraphId,
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      graphState: input.graphState,
      graphEligibilityState: input.graphEligibilityState,
      nodeCount: input.nodeCount,
      edgeCount: input.edgeCount,
      readyNodeCount: input.readyNodeCount,
      runningNodeCount: input.runningNodeCount,
      completedNodeCount: input.completedNodeCount,
      blockedNodeCount: input.blockedNodeCount,
      blockingReasons: input.blockingReasons,
      limitations: input.limitations,
    }),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function createTaskGraphMaterializer(options: {
  projection?: TaskGraphProjectionEngine;
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
  const projection = options.projection ?? createTaskGraphProjection({
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

  function materializeOne(input: {
    taskGraphId: string;
  }): MissionTaskGraphMaterializationSummary {
    const projectedInitial = projection.projectOne({ taskGraphId: input.taskGraphId });

    ensureTaskGraphArtifactDir({
      taskGraphId: projectedInitial.taskGraphId,
      rootDir: options.taskGraphArtifactsRoot,
    });

    historyStore.append({
      taskGraphId: projectedInitial.taskGraphId,
      executionEngineRunId: projectedInitial.executionEngineRunId,
      executionAttemptId: projectedInitial.executionAttemptId,
      runtimeEnvelopeId: projectedInitial.runtimeEnvelopeId,
      executionContractId: projectedInitial.executionContractId,
      missionId: projectedInitial.missionId,
      eventType: 'graph_materialized',
      reasoning: 'task_graph_projection_materialized',
      eventPayload: {
        taskGraphId: projectedInitial.taskGraphId,
      },
    });

    const projected = projection.projectOne({ taskGraphId: input.taskGraphId });

    const paths = resolveTaskGraphArtifactPaths({
      taskGraphId: projected.taskGraphId,
      rootDir: options.taskGraphArtifactsRoot,
    });

    const history = historyStore.load({
      taskGraphId: projected.taskGraphId,
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      taskGraphId: projected.taskGraphId,
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      graphState: projected.graphState,
      graphEligibilityState: projected.graphEligibilityState,
      nodeCount: projected.nodeCount,
      edgeCount: projected.edgeCount,
      readyNodeCount: projected.readyNodeCount,
      runningNodeCount: projected.runningNodeCount,
      completedNodeCount: projected.completedNodeCount,
      blockedNodeCount: projected.blockedNodeCount,
      blockingReasons: projected.blockingReasons,
      limitations: projected.limitations,
    }), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.nodesJsonPath, `${canonicalStringify(projected.taskNodes)}\n`, 'utf8');
    fs.writeFileSync(paths.edgesJsonPath, `${canonicalStringify(projected.taskEdges)}\n`, 'utf8');

    return {
      taskGraphId: projected.taskGraphId,
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      nodesPath: paths.nodesJsonPath,
      edgesPath: paths.edgesJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type TaskGraphMaterializer = ReturnType<typeof createTaskGraphMaterializer>;
