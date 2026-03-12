import { describe, expect, it } from 'vitest';

import type { MissionTaskGraph } from '../../task-graph/task-graph-types.ts';
import { detectReadyTaskNodeIds } from '../../task-execution/task-ready-node-detector.ts';

function makeGraph(): MissionTaskGraph {
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
      {
        taskNodeId: 'node-c',
        taskGraphId: 'tg-1',
        taskType: 'authorized_action',
        taskName: 'C',
        taskDescription: 'C',
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
      {
        taskEdgeId: 'edge-a-c',
        taskGraphId: 'tg-1',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-c',
        dependencyType: 'finish_to_start',
        edgeState: 'active',
      },
    ],
    graphState: 'evaluated',
    graphEligibilityState: 'waiting_on_dependencies',
    nodeCount: 3,
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

describe('task ready node detector', () => {
  it('T-MTE-RND1 node is ready only when dependencies are completed', () => {
    const graph = makeGraph();

    const noneReady = detectReadyTaskNodeIds({
      taskGraph: graph,
      nodeStates: {
        'node-a': 'running',
        'node-b': 'pending',
        'node-c': 'pending',
      },
    });

    const downstreamReady = detectReadyTaskNodeIds({
      taskGraph: graph,
      nodeStates: {
        'node-a': 'completed',
        'node-b': 'pending',
        'node-c': 'pending',
      },
    });

    expect(noneReady).toEqual([]);
    expect(downstreamReady).toEqual(['node-b', 'node-c']);
  });

  it('T-MTE-RND2 ordering is deterministic and lexical tie-break is stable', () => {
    const graph = makeGraph();

    const ready = detectReadyTaskNodeIds({
      taskGraph: graph,
      nodeStates: {
        'node-a': 'completed',
        'node-b': 'pending',
        'node-c': 'pending',
      },
    });

    expect(ready).toEqual(['node-b', 'node-c']);
  });
});
