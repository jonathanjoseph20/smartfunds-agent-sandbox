import { describe, expect, it } from 'vitest';

import type { MissionTaskNode } from '../../task-graph/task-graph-types.ts';
import { deriveTaskGraphStatus } from '../../task-graph/task-graph-status.ts';

function node(taskNodeId: string, taskState: MissionTaskNode['taskState'], blockingReasons: string[] = []): MissionTaskNode {
  return {
    taskNodeId,
    taskGraphId: 'tg-1',
    taskType: 'authorized_action',
    taskName: taskNodeId,
    taskDescription: taskNodeId,
    taskInputs: {},
    taskOutputs: {},
    requiredCapabilities: [],
    taskState,
    taskEligibilityState: taskState === 'ready' ? 'eligible' : 'waiting_on_dependencies',
    blockingReasons,
    limitations: [],
    provenanceInputs: {},
  };
}

describe('task graph status', () => {
  it('T-MTG-S1 derives ready_for_execution when ready nodes exist', () => {
    const status = deriveTaskGraphStatus({
      taskNodes: [
        node('n-1', 'ready'),
        node('n-2', 'pending', ['dependency_unsatisfied:n-1']),
      ],
    });

    expect(status.graphState).toBe('ready_for_execution');
    expect(status.readyNodeCount).toBe(1);
  });

  it('T-MTG-S2 derives completed when all nodes are completed', () => {
    const status = deriveTaskGraphStatus({
      taskNodes: [node('n-1', 'completed'), node('n-2', 'completed')],
    });

    expect(status.graphState).toBe('completed');
    expect(status.completedNodeCount).toBe(2);
  });

  it('T-MTG-S3 derives blocked when a node has failed', () => {
    const status = deriveTaskGraphStatus({
      taskNodes: [
        node('n-1', 'completed'),
        node('n-2', 'failed', ['task_failed:n-2']),
      ],
    });

    expect(status.graphState).toBe('blocked');
    expect(status.graphEligibilityState).toBe('blocked');
    expect(status.blockingReasons).toContain('task_failed:n-2');
  });

  it('T-MTG-S4 derives blocked when all pending nodes have unsatisfied dependencies', () => {
    const status = deriveTaskGraphStatus({
      taskNodes: [
        node('n-1', 'pending', ['dependency_unsatisfied:n-0']),
      ],
    });

    expect(status.graphState).toBe('blocked');
    expect(status.blockingReasons).toContain('dependency_unsatisfied:n-0');
  });
});
