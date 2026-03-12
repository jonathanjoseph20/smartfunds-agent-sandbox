import { describe, expect, it } from 'vitest';

import { createTaskWorkerDispatcher } from '../../task-execution/task-worker-dispatcher.ts';
import type { MissionTaskGraphProjection } from '../../task-graph/task-graph-types.ts';

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
        taskType: 'shell',
        taskName: 'A',
        taskDescription: 'A',
        taskInputs: {},
        taskOutputs: {},
        requiredCapabilities: ['filesystem'],
        taskState: 'ready',
        taskEligibilityState: 'eligible',
        blockingReasons: [],
        limitations: [],
        provenanceInputs: {},
      },
      {
        taskNodeId: 'node-b',
        taskGraphId: 'tg-1',
        taskType: 'shell',
        taskName: 'B',
        taskDescription: 'B',
        taskInputs: {},
        taskOutputs: {},
        requiredCapabilities: ['filesystem'],
        taskState: 'ready',
        taskEligibilityState: 'eligible',
        blockingReasons: [],
        limitations: [],
        provenanceInputs: {},
      },
      {
        taskNodeId: 'node-c',
        taskGraphId: 'tg-1',
        taskType: 'shell',
        taskName: 'C',
        taskDescription: 'C',
        taskInputs: {},
        taskOutputs: {},
        requiredCapabilities: ['gpu'],
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
    nodeCount: 3,
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
      ready: 3,
      running: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    },
    readyNodeCount: 3,
    runningNodeCount: 0,
    completedNodeCount: 0,
    blockedNodeCount: 0,
    statusPreview: {},
    reportPreview: {},
    artifactPaths: {
      dirPath: '',
      statusJsonPath: '',
      reportJsonPath: '',
      reportMarkdownPath: '',
      historyJsonPath: '',
      nodesJsonPath: '',
      edgesJsonPath: '',
    },
  };
}

describe('task worker dispatcher', () => {
  it('T-TW-D1 filters runnable nodes by worker capability and keeps deterministic order', () => {
    const taskGraph = makeTaskGraph();
    const dispatcher = createTaskWorkerDispatcher({
      taskGraphProjection: {
        projectOne: () => taskGraph,
        projectAll: () => [taskGraph],
        summarizeList: () => [{ taskGraphId: taskGraph.taskGraphId }],
      } as never,
      projection: {
        projectOne: () => ({
          executionEngineRunId: 'er-1',
          executionAttemptId: 'ea-1',
          taskGraphId: 'tg-1',
          nodeStates: {
            'node-a': 'ready',
            'node-b': 'ready',
            'node-c': 'ready',
          },
          retryAttempts: [{
            taskNodeId: 'node-b',
            attemptIndex: 1,
            failureClass: 'RETRYABLE_FAILURE',
            retryPolicyId: 'mission_task_retry_default_v1',
            retryState: 'started',
            retryCount: 1,
          }],
        }),
      } as never,
      historyStore: {
        load: () => ({ executionEngineRunId: 'er-1', executionAttemptId: 'ea-1', taskGraphId: 'tg-1', entries: [] }),
      } as never,
    });

    const candidates = dispatcher.discoverWork({ taskGraphId: 'tg-1', workerId: 'default-local-worker' });

    expect(candidates.map((candidate) => candidate.taskNodeId)).toEqual(['node-b', 'node-a']);
    expect(candidates.every((candidate) => candidate.taskNodeId !== 'node-c')).toBe(true);
  });
});
