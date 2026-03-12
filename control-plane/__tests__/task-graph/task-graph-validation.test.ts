import { describe, expect, it } from 'vitest';

import type { MissionTaskEdge, MissionTaskNode } from '../../task-graph/task-graph-types.ts';
import { validateTaskGraph } from '../../task-graph/task-graph-validation.ts';

function makeNode(taskGraphId: string, taskNodeId: string): MissionTaskNode {
  return {
    taskNodeId,
    taskGraphId,
    taskType: 'authorized_action',
    taskName: taskNodeId,
    taskDescription: taskNodeId,
    taskInputs: {},
    taskOutputs: {},
    requiredCapabilities: [],
    taskState: 'pending',
    taskEligibilityState: 'waiting_on_dependencies',
    blockingReasons: [],
    limitations: [],
    provenanceInputs: {},
  };
}

function makeEdge(taskGraphId: string, taskEdgeId: string, sourceNodeId: string, targetNodeId: string, dependencyType: MissionTaskEdge['dependencyType']): MissionTaskEdge {
  return {
    taskEdgeId,
    taskGraphId,
    sourceNodeId,
    targetNodeId,
    dependencyType,
    edgeState: 'active',
  };
}

describe('task graph validation', () => {
  it('T-MTG-V1 rejects invalid node references in edges', () => {
    const taskGraphId = 'tg-1';

    expect(() => validateTaskGraph({
      taskGraphId,
      taskNodes: [makeNode(taskGraphId, 'n-1')],
      taskEdges: [makeEdge(taskGraphId, 'e-1', 'n-1', 'n-missing', 'finish_to_start')],
    })).toThrowError('TASK_GRAPH_INVALID_NODE_REFERENCE');
  });

  it('T-MTG-V2 rejects invalid dependency types', () => {
    const taskGraphId = 'tg-1';

    expect(() => validateTaskGraph({
      taskGraphId,
      taskNodes: [makeNode(taskGraphId, 'n-1'), makeNode(taskGraphId, 'n-2')],
      taskEdges: [{
        ...makeEdge(taskGraphId, 'e-1', 'n-1', 'n-2', 'finish_to_start'),
        dependencyType: 'invalid_dependency' as never,
      }],
    })).toThrowError('TASK_GRAPH_INVALID_DEPENDENCY_TYPE');
  });

  it('T-MTG-V3 detects cycles deterministically', () => {
    const taskGraphId = 'tg-1';

    expect(() => validateTaskGraph({
      taskGraphId,
      taskNodes: [makeNode(taskGraphId, 'a'), makeNode(taskGraphId, 'b'), makeNode(taskGraphId, 'c')],
      taskEdges: [
        makeEdge(taskGraphId, 'e-1', 'a', 'b', 'finish_to_start'),
        makeEdge(taskGraphId, 'e-2', 'b', 'c', 'finish_to_start'),
        makeEdge(taskGraphId, 'e-3', 'c', 'a', 'finish_to_start'),
      ],
    })).toThrowError('TASK_GRAPH_CYCLE_DETECTED');
  });

  it('T-MTG-V4 rejects disconnected graphs with deterministic error', () => {
    const taskGraphId = 'tg-1';

    expect(() => validateTaskGraph({
      taskGraphId,
      taskNodes: [
        makeNode(taskGraphId, 'n-1'),
        makeNode(taskGraphId, 'n-2'),
        makeNode(taskGraphId, 'n-3'),
      ],
      taskEdges: [
        makeEdge(taskGraphId, 'e-1', 'n-1', 'n-2', 'finish_to_start'),
      ],
    })).toThrowError('TASK_GRAPH_DISCONNECTED');
  });

  it('T-MTG-V5 accepts structurally valid non-finish-to-start dependencies', () => {
    const taskGraphId = 'tg-1';

    expect(() => validateTaskGraph({
      taskGraphId,
      taskNodes: [
        makeNode(taskGraphId, 'n-1'),
        makeNode(taskGraphId, 'n-2'),
      ],
      taskEdges: [
        makeEdge(taskGraphId, 'e-1', 'n-1', 'n-2', 'start_to_start'),
      ],
    })).not.toThrow();
  });
});
