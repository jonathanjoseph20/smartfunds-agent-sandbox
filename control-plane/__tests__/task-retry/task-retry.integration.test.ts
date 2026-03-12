import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskExecutionEngine } from '../../task-execution/task-execution-engine.ts';
import { createTaskExecutionHistoryStore, resolveTaskExecutionArtifactPaths } from '../../task-execution/task-execution-history-store.ts';
import { createTaskExecutionProjection } from '../../task-execution/task-execution-projection.ts';
import type { MissionTaskGraphProjection } from '../../task-graph/task-graph-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-retry');

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
        retryPolicy: {
          retryPolicyId: 'mission_task_retry_default_v1',
          maxRetries: 3,
          retryStrategy: 'immediate',
          retryDelayModel: 'deterministic_linear',
          retryConditions: ['RETRYABLE_FAILURE', 'SYSTEM_FAILURE'],
          baseDelay: 1,
        },
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
        retryPolicy: {
          retryPolicyId: 'mission_task_retry_default_v1',
          maxRetries: 1,
          retryStrategy: 'immediate',
          retryDelayModel: 'deterministic_linear',
          retryConditions: ['RETRYABLE_FAILURE'],
          baseDelay: 1,
        },
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

describe('task retry integration', () => {
  it('T-MTE-RI1 supports deterministic failure->retry->completion path', () => {
    const harness = createHarness(path.join(tmpRoot, 'retry-success'));

    const failed = harness.engine.failNode({
      taskGraphId: harness.taskGraph.taskGraphId,
      taskNodeId: 'node-a',
      failureCode: 'TEMPORARY_TOOL_ERROR',
    });
    expect(failed.failureClass).toBe('RETRYABLE_FAILURE');

    const retried = harness.engine.retryNode({
      taskGraphId: harness.taskGraph.taskGraphId,
      taskNodeId: 'node-a',
    });

    expect(retried.retryScheduled).toBe(true);
    expect(retried.projection.nodeStates['node-a']).toBe('ready');

    harness.engine.step({ taskGraphId: harness.taskGraph.taskGraphId });
    const finished = harness.engine.advance({ taskGraphId: harness.taskGraph.taskGraphId });

    expect(finished.projection.graphState).toBe('completed');
    expect(finished.projection.graphFailureState).toBe('none');
  });

  it('T-MTE-RI2 policy failure exhausts retries and blocks downstream nodes', () => {
    const harness = createHarness(path.join(tmpRoot, 'retry-exhausted'));

    harness.engine.failNode({
      taskGraphId: harness.taskGraph.taskGraphId,
      taskNodeId: 'node-a',
      failureCode: 'POLICY_VIOLATION',
    });

    const retried = harness.engine.retryNode({
      taskGraphId: harness.taskGraph.taskGraphId,
      taskNodeId: 'node-a',
    });

    expect(retried.retryScheduled).toBe(false);

    const projected = harness.projection.projectOne({ taskGraphId: harness.taskGraph.taskGraphId });

    expect(projected.nodeStates['node-a']).toBe('permanently_failed');
    expect(projected.nodeStates['node-b']).toBe('blocked');
    expect(projected.graphState).toBe('failed');
    expect(projected.graphFailureState).toBe('retry_exhausted');
  });

  it('T-MTE-RI3 deterministic replay is stable across identical runs', () => {
    const first = createHarness(path.join(tmpRoot, 'determinism-a'));
    const second = createHarness(path.join(tmpRoot, 'determinism-b'));

    for (const harness of [first, second]) {
      harness.engine.failNode({
        taskGraphId: harness.taskGraph.taskGraphId,
        taskNodeId: 'node-a',
        failureCode: 'TEMPORARY_TOOL_ERROR',
      });
      harness.engine.retryNode({
        taskGraphId: harness.taskGraph.taskGraphId,
        taskNodeId: 'node-a',
      });
      harness.engine.step({ taskGraphId: harness.taskGraph.taskGraphId });
      harness.engine.advance({ taskGraphId: harness.taskGraph.taskGraphId });
    }

    const firstHistoryPath = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: first.taskGraph.executionEngineRunId,
      rootDir: path.join(tmpRoot, 'determinism-a', 'artifacts'),
    }).historyJsonPath;

    const secondHistoryPath = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: second.taskGraph.executionEngineRunId,
      rootDir: path.join(tmpRoot, 'determinism-b', 'artifacts'),
    }).historyJsonPath;

    expect(fs.readFileSync(firstHistoryPath, 'utf8')).toBe(fs.readFileSync(secondHistoryPath, 'utf8'));
  });
});
