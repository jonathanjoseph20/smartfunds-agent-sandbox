import { describe, expect, it } from 'vitest';

import { createTaskGraphProjection } from '../../task-graph/task-graph-projection.ts';
import type { MissionTaskGraph } from '../../task-graph/task-graph-types.ts';

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
    ],
    taskEdges: [
      {
        taskEdgeId: 'edge-1',
        taskGraphId: 'tg-1',
        sourceNodeId: 'node-a',
        targetNodeId: 'node-b',
        dependencyType: 'finish_to_start',
        edgeState: 'active',
      },
    ],
    graphState: 'initialized',
    graphEligibilityState: 'waiting_on_dependencies',
    nodeCount: 2,
    edgeCount: 1,
    blockingReasons: [],
    limitations: ['task_graph_structure_only_sprint_6_1'],
    provenanceInputs: {
      engineState: 'eligible_to_start',
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

describe('task graph projection', () => {
  it('T-MTG-P1 projection output preserves deterministic stable ordering', () => {
    const evaluator = {
      evaluateTaskGraph: () => ({ taskGraph: makeGraph() }),
      evaluateAllTaskGraphs: () => [{ taskGraph: makeGraph() }],
    };

    const historyStore = {
      load: () => ({
        taskGraphId: 'tg-1',
        executionEngineRunId: 'er-1',
        executionAttemptId: 'ea-1',
        runtimeEnvelopeId: 're-1',
        executionContractId: 'ec-1',
        missionId: 'm-1',
        entries: [],
      }),
      loadByTaskGraphId: () => ({
        taskGraphId: 'tg-1',
        executionEngineRunId: 'er-1',
        executionAttemptId: 'ea-1',
        runtimeEnvelopeId: 're-1',
        executionContractId: 'ec-1',
        missionId: 'm-1',
        entries: [],
      }),
    };

    const projection = createTaskGraphProjection({
      evaluator: evaluator as never,
      historyStore: historyStore as never,
    });

    const first = projection.projectOne({ taskGraphId: 'tg-1' });
    const second = projection.projectOne({ taskGraphId: 'tg-1' });

    expect(first.taskNodes.map((node) => node.taskNodeId)).toEqual(['node-a', 'node-b']);
    expect(second).toEqual(first);
    expect(first.graphState).toBe('ready_for_execution');
    expect(first.readyNodeCount).toBe(1);
  });

  it('T-MTG-P2 derives blocked graph state from failed nodes', () => {
    const evaluator = {
      evaluateTaskGraph: () => ({
        taskGraph: {
          ...makeGraph(),
          taskNodes: [
            {
              ...makeGraph().taskNodes[0]!,
              taskState: 'failed' as const,
              blockingReasons: ['task_failed:node-b'],
            },
          ],
          nodeCount: 1,
          taskEdges: [],
          edgeCount: 0,
        },
      }),
      evaluateAllTaskGraphs: () => [],
    };

    const historyStore = {
      load: () => ({
        taskGraphId: 'tg-1',
        executionEngineRunId: 'er-1',
        executionAttemptId: 'ea-1',
        runtimeEnvelopeId: 're-1',
        executionContractId: 'ec-1',
        missionId: 'm-1',
        entries: [],
      }),
      loadByTaskGraphId: () => null,
    };

    const projection = createTaskGraphProjection({
      evaluator: evaluator as never,
      historyStore: historyStore as never,
    });

    const result = projection.projectOne({ executionEngineRunId: 'er-1' });
    expect(result.graphState).toBe('blocked');
    expect(result.blockingReasons).toContain('task_failed:node-b');
  });
});
