import { describe, expect, it } from 'vitest';

import type { MissionTaskGraph } from '../../task-graph/task-graph-types.ts';
import {
  dependenciesSatisfiedForTaskRetry,
  scheduleTaskRetry,
  sortTaskRetrySchedule,
} from '../../task-execution/task-retry-scheduler.ts';

function graph(): MissionTaskGraph {
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
        taskState: 'pending',
        taskEligibilityState: 'waiting_on_dependencies',
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
        blockingReasons: [],
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
    graphState: 'running',
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
  };
}

describe('task retry scheduler', () => {
  it('T-MTE-RS1 enforces deterministic schedule ordering', () => {
    const sorted = sortTaskRetrySchedule([
      { taskNodeId: 'node-b', attemptIndex: 2, dependencySatisfied: true },
      { taskNodeId: 'node-a', attemptIndex: 1, dependencySatisfied: true },
      { taskNodeId: 'node-c', attemptIndex: 1, dependencySatisfied: false },
    ]);

    expect(sorted).toEqual([
      { taskNodeId: 'node-a', attemptIndex: 1, dependencySatisfied: true },
      { taskNodeId: 'node-b', attemptIndex: 2, dependencySatisfied: true },
      { taskNodeId: 'node-c', attemptIndex: 1, dependencySatisfied: false },
    ]);
  });

  it('T-MTE-RS2 checks dependency satisfaction deterministically', () => {
    const taskGraph = graph();

    const pending = dependenciesSatisfiedForTaskRetry({
      taskGraph,
      taskNodeId: 'node-b',
      nodeStates: {
        'node-a': 'failed',
        'node-b': 'failed',
      },
    });

    const ready = dependenciesSatisfiedForTaskRetry({
      taskGraph,
      taskNodeId: 'node-b',
      nodeStates: {
        'node-a': 'completed',
        'node-b': 'failed',
      },
    });

    expect(pending).toBe(false);
    expect(ready).toBe(true);
  });

  it('T-MTE-RS3 dedupes queued retries deterministically', () => {
    const queue = scheduleTaskRetry({
      queue: [],
      taskNodeId: 'node-a',
      attemptIndex: 1,
      dependencySatisfied: true,
    });

    const deduped = scheduleTaskRetry({
      queue,
      taskNodeId: 'node-a',
      attemptIndex: 1,
      dependencySatisfied: true,
    });

    expect(deduped).toHaveLength(1);
  });
});
