import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskExecutionEngine } from '../../task-execution/task-execution-engine.ts';
import { createTaskExecutionHistoryStore } from '../../task-execution/task-execution-history-store.ts';
import { createTaskExecutionProjection } from '../../task-execution/task-execution-projection.ts';
import type { MissionTaskGraphProjection } from '../../task-graph/task-graph-types.ts';

const tmpRoot = path.join('control-plane', 'tests', 'task-concurrency', 'tmp-engine');

function makeParallelReadyGraph(): MissionTaskGraphProjection {
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
        taskState: 'ready',
        taskEligibilityState: 'eligible',
        blockingReasons: [],
        limitations: [],
        provenanceInputs: {},
      },
    ],
    taskEdges: [],
    graphState: 'ready_for_execution',
    graphEligibilityState: 'eligible',
    nodeCount: 2,
    edgeCount: 0,
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
    historySummary: { totalEvents: 0 },
    nodeStateCounts: {
      pending: 0,
      ready: 2,
      running: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    },
    readyNodeCount: 2,
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

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task concurrency engine integration', () => {
  it('T-MTC-I1 one step schedules multiple ready nodes deterministically', () => {
    const graph = makeParallelReadyGraph();
    const taskGraphProjection = {
      projectOne: () => graph,
      projectAll: () => [graph],
      summarizeList: () => [{ taskGraphId: graph.taskGraphId }],
    };

    const artifactsRoot = path.join(tmpRoot, 'artifacts');
    const historyStore = createTaskExecutionHistoryStore({ artifactsRoot });
    const projection = createTaskExecutionProjection({
      taskGraphProjection: taskGraphProjection as never,
      historyStore,
      taskExecutionArtifactsRoot: artifactsRoot,
    });

    const engine = createTaskExecutionEngine({
      taskGraphProjection: taskGraphProjection as never,
      projection,
      historyStore,
      taskExecutionArtifactsRoot: artifactsRoot,
    });

    const result = engine.step({ taskGraphId: graph.taskGraphId });
    const history = historyStore.load({
      executionEngineRunId: graph.executionEngineRunId,
      executionAttemptId: graph.executionAttemptId,
      taskGraphId: graph.taskGraphId,
    });

    expect(result.scheduledNodeIds).toEqual(['node-a', 'node-b']);
    expect(result.deferredNodeIds).toEqual([]);
    expect(result.projection.completedNodeCount).toBe(2);

    const scheduledEvents = history.entries.filter((entry) => entry.eventType === 'node_scheduled_for_execution');
    expect(scheduledEvents.map((entry) => entry.eventPayload.taskNodeId)).toEqual(['node-a', 'node-b']);
  });
});
