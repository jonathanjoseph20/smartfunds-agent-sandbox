import { describe, expect, it } from 'vitest';

import type { MissionTaskExecutionProjection, MissionTaskExecutionHistory } from '../../task-execution/task-execution-step-types.ts';
import type { MissionTaskGraph } from '../../task-graph/task-graph-types.ts';
import { evaluateRunnableNodeSet } from '../../task-execution/task-runnable-node-set.ts';
import { PARALLEL_WAVE_DEFAULT, SINGLE_LANE_DEFAULT } from '../../task-execution/task-concurrency-policies.ts';
import { computeSchedulingWave } from '../../task-execution/task-concurrency-scheduler.ts';

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
      {
        taskNodeId: 'node-c',
        taskGraphId: 'tg-1',
        taskType: 'authorized_action',
        taskName: 'C',
        taskDescription: 'C',
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
        taskNodeId: 'node-d',
        taskGraphId: 'tg-1',
        taskType: 'authorized_action',
        taskName: 'D',
        taskDescription: 'D',
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
        taskNodeId: 'node-running',
        taskGraphId: 'tg-1',
        taskType: 'authorized_action',
        taskName: 'Running',
        taskDescription: 'Running',
        taskInputs: {},
        taskOutputs: {},
        requiredCapabilities: [],
        taskState: 'running',
        taskEligibilityState: 'eligible',
        blockingReasons: [],
        limitations: [],
        provenanceInputs: {},
      },
      {
        taskNodeId: 'node-retrying',
        taskGraphId: 'tg-1',
        taskType: 'authorized_action',
        taskName: 'Retrying',
        taskDescription: 'Retrying',
        taskInputs: {},
        taskOutputs: {},
        requiredCapabilities: [],
        taskState: 'failed',
        taskEligibilityState: 'waiting_on_dependencies',
        blockingReasons: [],
        limitations: [],
        provenanceInputs: {},
      },
      {
        taskNodeId: 'node-completed',
        taskGraphId: 'tg-1',
        taskType: 'authorized_action',
        taskName: 'Completed',
        taskDescription: 'Completed',
        taskInputs: {},
        taskOutputs: {},
        requiredCapabilities: [],
        taskState: 'completed',
        taskEligibilityState: 'eligible',
        blockingReasons: [],
        limitations: [],
        provenanceInputs: {},
      },
      {
        taskNodeId: 'node-blocked',
        taskGraphId: 'tg-1',
        taskType: 'authorized_action',
        taskName: 'Blocked',
        taskDescription: 'Blocked',
        taskInputs: {},
        taskOutputs: {},
        requiredCapabilities: [],
        taskState: 'blocked',
        taskEligibilityState: 'blocked',
        blockingReasons: ['DEPENDENCY_FAILED'],
        limitations: [],
        provenanceInputs: {},
      },
    ],
    taskEdges: [
      {
        taskEdgeId: 'edge-a-c',
        taskGraphId: 'tg-1',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-c',
        dependencyType: 'finish_to_start',
        edgeState: 'active',
      },
      {
        taskEdgeId: 'edge-b-d',
        taskGraphId: 'tg-1',
        sourceNodeId: 'node-b',
        targetNodeId: 'node-d',
        dependencyType: 'finish_to_start',
        edgeState: 'active',
      },
    ],
    graphState: 'running',
    graphEligibilityState: 'eligible',
    nodeCount: 8,
    edgeCount: 2,
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

function projection(overrides: Partial<MissionTaskExecutionProjection>): MissionTaskExecutionProjection {
  return {
    executionEngineRunId: 'er-1',
    executionAttemptId: 'ea-1',
    taskGraphId: 'tg-1',
    executionStepCount: 0,
    failedNodeCount: 0,
    retryingNodeCount: 1,
    readyNodeCount: 4,
    runnableNodeCount: 0,
    scheduledNodeCount: 0,
    deferredNodeCount: 0,
    runningNodeCount: 1,
    completedNodeCount: 1,
    blockedNodeCount: 1,
    graphState: 'running',
    executionProgress: { completed: 1, total: 8, ratio: 0.125 },
    blockingReasons: [],
    blockingNodes: ['node-blocked'],
    lastExecutionStepId: null,
    engineState: 'active',
    steps: [],
    nodeStates: {
      'node-a': 'ready',
      'node-b': 'ready',
      'node-c': 'ready',
      'node-d': 'ready',
      'node-running': 'running',
      'node-retrying': 'retrying',
      'node-completed': 'completed',
      'node-blocked': 'blocked',
    },
    retryAttempts: [
      { taskNodeId: 'node-b', attemptIndex: 2, failureClass: 'RETRYABLE_FAILURE', retryPolicyId: 'p', retryState: 'started', retryCount: 2 },
      { taskNodeId: 'node-c', attemptIndex: 1, failureClass: 'RETRYABLE_FAILURE', retryPolicyId: 'p', retryState: 'started', retryCount: 1 },
    ],
    retryLimitBreaches: [],
    concurrencyPolicyId: 'parallel-wave-default',
    maxConcurrentNodes: 4,
    activeConcurrencySlots: 0,
    availableConcurrencySlots: 4,
    currentWaveIndex: 0,
    currentWaveNodeIds: [],
    deferredNodeIds: [],
    schedulingState: 'wave_ready',
    schedulingWaves: [],
    graphFailureState: 'none',
    statusPreview: {},
    reportPreview: {},
    artifactPaths: {
      dirPath: '',
      statusJsonPath: '',
      reportJsonPath: '',
      reportMarkdownPath: '',
      historyJsonPath: '',
      stepsJsonPath: '',
      progressJsonPath: '',
      failuresJsonPath: '',
      retriesJsonPath: '',
      blockersJsonPath: '',
      concurrencyJsonPath: '',
      runnableSetJsonPath: '',
      schedulingWavesJsonPath: '',
    },
    provenanceInputs: {
      taskGraphState: 'running',
      taskGraphNodeCount: 8,
      taskGraphEdgeCount: 2,
      taskGraphBlockingReasons: [],
    },
    ...overrides,
  };
}

const history: MissionTaskExecutionHistory = {
  executionEngineRunId: 'er-1',
  executionAttemptId: 'ea-1',
  taskGraphId: 'tg-1',
  entries: [],
};

describe('task runnable node set', () => {
  it('T-MTC-R1 applies runnable inclusion/exclusion rules', () => {
    const result = evaluateRunnableNodeSet(graph(), projection({}), history, PARALLEL_WAVE_DEFAULT);

    expect(result.runnableNodeIds).toEqual(['node-a', 'node-b', 'node-d', 'node-c']);
    expect(result.excludedNodes.alreadyRunning).toEqual(['node-running']);
    expect(result.excludedNodes.retryWaiting).toEqual(['node-retrying']);
    expect(result.excludedNodes.blocked).toEqual(['node-blocked']);
  });

  it('T-MTC-R2 enforces deterministic single-lane and slot allocation', () => {
    const projected = projection({});
    const result = evaluateRunnableNodeSet(graph(), projected, history, SINGLE_LANE_DEFAULT);
    const wave = computeSchedulingWave(result, SINGLE_LANE_DEFAULT, projected);

    expect(result.runnableNodeIds).toEqual(['node-a', 'node-b']);
    expect(wave.scheduledNodeIds).toEqual(['node-a']);
    expect(wave.deferredNodeIds).toEqual(['node-b']);
  });

  it('T-MTC-R3 parallel wave scheduling is stable for same inputs', () => {
    const projected = projection({});

    const left = computeSchedulingWave(
      evaluateRunnableNodeSet(graph(), projected, history, PARALLEL_WAVE_DEFAULT),
      PARALLEL_WAVE_DEFAULT,
      projected,
    );

    const right = computeSchedulingWave(
      evaluateRunnableNodeSet(graph(), projected, history, PARALLEL_WAVE_DEFAULT),
      PARALLEL_WAVE_DEFAULT,
      projected,
    );

    expect(left).toEqual(right);
  });
});
