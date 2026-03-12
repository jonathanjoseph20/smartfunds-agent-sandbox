import { describe, expect, it } from 'vitest';

import { scheduleWorkerAssignments } from '../../task-execution/task-worker-scheduler.ts';
import { RETRY_PRIORITY_DEFAULT } from '../../task-execution/task-assignment-decision.ts';
import type { MissionTaskNode } from '../../task-graph/task-graph-types.ts';

function node(taskNodeId: string, capabilities: string[] = ['filesystem']): MissionTaskNode {
  return {
    taskNodeId,
    taskGraphId: 'tg-1',
    taskType: 'shell',
    taskName: taskNodeId,
    taskDescription: taskNodeId,
    taskInputs: {},
    taskOutputs: {},
    requiredCapabilities: capabilities,
    taskState: 'ready',
    taskEligibilityState: 'eligible',
    blockingReasons: [],
    limitations: [],
    provenanceInputs: {},
  };
}

describe('task worker scheduler', () => {
  it('T-MTO-S1 deterministic assignment ordering respects retry priority and lexical tie breaks', () => {
    const decisions = scheduleWorkerAssignments({
      executionRunId: 'er-1',
      taskGraphId: 'tg-1',
      cycleIndex: 1,
      policy: RETRY_PRIORITY_DEFAULT,
      runnableNodeIds: ['node-c', 'node-a', 'node-b'],
      taskNodes: [node('node-a'), node('node-b'), node('node-c')],
      taskEdges: [],
      workers: [
        {
          workerId: 'worker-b',
          workerType: 'local',
          supportedTaskTypes: ['shell'],
          capabilities: ['filesystem'],
          status: 'active',
          maxConcurrentAssignments: 2,
        },
        {
          workerId: 'worker-a',
          workerType: 'local',
          supportedTaskTypes: ['shell'],
          capabilities: ['filesystem'],
          status: 'active',
          maxConcurrentAssignments: 2,
        },
      ],
      retryAttemptByNode: {
        'node-b': 1,
      },
      currentAssignedByWorker: {
        'worker-a': 0,
        'worker-b': 0,
      },
    });

    expect(decisions.map((decision) => decision.taskNodeId)).toEqual(['node-a', 'node-b', 'node-c']);
    expect(decisions.find((decision) => decision.taskNodeId === 'node-b')?.assignmentState).toBe('assigned');
  });

  it('T-MTO-S2 emits explicit deferred reasons for incompatibility and no capacity', () => {
    const decisions = scheduleWorkerAssignments({
      executionRunId: 'er-1',
      taskGraphId: 'tg-1',
      cycleIndex: 1,
      policy: {
        ...RETRY_PRIORITY_DEFAULT,
        maxAssignmentsPerCycle: 5,
      },
      runnableNodeIds: ['node-a', 'node-b'],
      taskNodes: [node('node-a', ['gpu']), node('node-b')],
      taskEdges: [],
      workers: [
        {
          workerId: 'worker-a',
          workerType: 'local',
          supportedTaskTypes: ['shell'],
          capabilities: ['filesystem'],
          status: 'active',
          maxConcurrentAssignments: 1,
        },
      ],
      retryAttemptByNode: {},
      currentAssignedByWorker: {
        'worker-a': 1,
      },
    });

    const incompatible = decisions.find((decision) => decision.taskNodeId === 'node-a');
    const capacity = decisions.find((decision) => decision.taskNodeId === 'node-b');

    expect(incompatible?.deferralReasonTokens).toEqual(['no_compatible_worker']);
    expect(capacity?.deferralReasonTokens).toEqual(['no_capacity']);
  });
});
