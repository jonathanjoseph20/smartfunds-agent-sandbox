import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskExecutionEngine } from '../../task-execution/task-execution-engine.ts';
import { createTaskExecutionHistoryStore, resolveTaskExecutionArtifactPaths } from '../../task-execution/task-execution-history-store.ts';
import { createTaskExecutionProjection } from '../../task-execution/task-execution-projection.ts';
import type { MissionTaskGraphProjection } from '../../task-graph/task-graph-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-execution-engine');

function makeTaskGraph(): MissionTaskGraphProjection {
  return {
    taskGraphId: 'tg-1',
    executionEngineRunId: 'er-1',
    executionAttemptId: 'ea-1',
    runtimeEnvelopeId: 're-1',
    executionContractId: 'ec-1',
    missionId: 'm-1',
    taskNodes: [
      {
        taskNodeId: 'node-a',
        taskGraphId: 'tg-1',
        taskType: 'authorized_action',
        taskName: 'A',
        taskDescription: 'A',
        taskInputs: {},
        taskOutputs: {},
        requiredCapabilities: [],
        taskState: 'ready',
        taskEligibilityState: 'eligible',
        blockingReasons: [],
        limitations: [],
        provenanceInputs: {},
      },
      {
        taskNodeId: 'node-b',
        taskGraphId: 'tg-1',
        taskType: 'authorized_action',
        taskName: 'B',
        taskDescription: 'B',
        taskInputs: {},
        taskOutputs: {},
        requiredCapabilities: [],
        taskState: 'pending',
        taskEligibilityState: 'waiting_on_dependencies',
        blockingReasons: ['dependency_unsatisfied:node-a'],
        limitations: [],
        provenanceInputs: {},
      },
    ],
    taskEdges: [
      {
        taskEdgeId: 'edge-a-b',
        taskGraphId: 'tg-1',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
        dependencyType: 'finish_to_start',
        edgeState: 'active',
      },
    ],
    graphState: 'ready_for_execution',
    graphEligibilityState: 'eligible',
    nodeCount: 2,
    edgeCount: 1,
    blockingReasons: [],
    limitations: [],
    provenanceInputs: {
      engineState: 'running',
      engineEligibilityState: 'eligible',
      engineBlockingReasons: [],
      engineLimitations: [],
      runtimeEnvelopeState: 'ready_for_runtime',
      runtimeEnvelopeEligibility: 'eligible',
      runtimeEnvelopeLimitations: [],
      runtimeEnvelopeBlockers: [],
    },
    historySummary: {
      totalEvents: 0,
    },
    nodeStateCounts: {
      pending: 1,
      ready: 1,
      running: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    },
    readyNodeCount: 1,
    runningNodeCount: 0,
    completedNodeCount: 0,
    blockedNodeCount: 0,
    statusPreview: { taskGraphId: 'tg-1' },
    reportPreview: { taskGraphId: 'tg-1' },
    artifactPaths: {
      dirPath: path.join('artifacts', 'task-graph', 'tg-1'),
      statusJsonPath: path.join('artifacts', 'task-graph', 'tg-1', 'task-graph-status.json'),
      reportJsonPath: path.join('artifacts', 'task-graph', 'tg-1', 'task-graph-report.json'),
      reportMarkdownPath: path.join('artifacts', 'task-graph', 'tg-1', 'task-graph-report.md'),
      historyJsonPath: path.join('artifacts', 'task-graph', 'tg-1', 'task-graph-history.json'),
      nodesJsonPath: path.join('artifacts', 'task-graph', 'tg-1', 'task-graph-nodes.json'),
      edgesJsonPath: path.join('artifacts', 'task-graph', 'tg-1', 'task-graph-edges.json'),
    },
  };
}

function createHarness(root: string) {
  const taskGraph = makeTaskGraph();
  const taskGraphProjection = {
    projectOne: () => taskGraph,
    projectAll: () => [taskGraph],
    summarizeList: () => [{ taskGraphId: taskGraph.taskGraphId }],
  };

  const historyStore = createTaskExecutionHistoryStore({ artifactsRoot: path.join(root, 'artifacts') });
  const projection = createTaskExecutionProjection({
    taskGraphProjection: taskGraphProjection as never,
    historyStore,
    taskExecutionArtifactsRoot: path.join(root, 'artifacts'),
  });

  const engine = createTaskExecutionEngine({
    taskGraphProjection: taskGraphProjection as never,
    projection,
    historyStore,
    taskExecutionArtifactsRoot: path.join(root, 'artifacts'),
  });

  return {
    engine,
    projection,
    historyStore,
    taskGraph,
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task execution engine', () => {
  it('T-MTE-E1 step progresses one selected node deterministically', () => {
    const harness = createHarness(path.join(tmpRoot, 'step'));

    const result = harness.engine.step({ taskGraphId: harness.taskGraph.taskGraphId });

    expect(result.selectedTaskNodeId).toBe('node-a');
    expect(result.scheduledNodeIds).toEqual(['node-a']);
    expect(result.deferredNodeIds).toEqual([]);
    expect(result.projection.completedNodeCount).toBe(1);
    expect(result.projection.executionStepCount).toBe(7);

    const history = harness.historyStore.load({
      executionEngineRunId: harness.taskGraph.executionEngineRunId,
      executionAttemptId: harness.taskGraph.executionAttemptId,
      taskGraphId: harness.taskGraph.taskGraphId,
    });

    expect(history.entries.map((entry) => entry.eventType)).toEqual([
      'concurrency_wave_evaluated',
      'concurrency_slots_allocated',
      'node_scheduled_for_execution',
      'concurrency_wave_completed',
      'node_execution_started',
      'node_execution_completed',
      'graph_execution_progressed',
    ]);
  });

  it('T-MTE-E2 advance progresses until completion or blocking', () => {
    const harness = createHarness(path.join(tmpRoot, 'advance'));

    const result = harness.engine.advance({ taskGraphId: harness.taskGraph.taskGraphId });

    expect(result.projection.graphState).toBe('completed');
    expect(result.projection.completedNodeCount).toBe(2);
    expect(result.projection.executionStepCount).toBeGreaterThanOrEqual(10);
  });

  it('T-MTE-E3 simulate is deterministic for identical inputs', () => {
    const firstHarness = createHarness(path.join(tmpRoot, 'simulate-a'));
    const secondHarness = createHarness(path.join(tmpRoot, 'simulate-b'));

    const first = firstHarness.engine.simulate({ taskGraphId: firstHarness.taskGraph.taskGraphId });
    const second = secondHarness.engine.simulate({ taskGraphId: secondHarness.taskGraph.taskGraphId });

    expect({
      ...first.projection,
      artifactPaths: undefined,
    }).toEqual({
      ...second.projection,
      artifactPaths: undefined,
    });

    const firstHistoryPath = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: firstHarness.taskGraph.executionEngineRunId,
      rootDir: path.join(tmpRoot, 'simulate-a', 'artifacts'),
    }).historyJsonPath;

    const secondHistoryPath = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: secondHarness.taskGraph.executionEngineRunId,
      rootDir: path.join(tmpRoot, 'simulate-b', 'artifacts'),
    }).historyJsonPath;

    expect(fs.readFileSync(firstHistoryPath, 'utf8')).toBe(fs.readFileSync(secondHistoryPath, 'utf8'));
  });
});
