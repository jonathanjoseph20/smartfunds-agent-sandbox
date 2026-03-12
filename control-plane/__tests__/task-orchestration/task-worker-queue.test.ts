import { describe, expect, it } from 'vitest';

import { deriveTaskWorkerQueueState } from '../../task-execution/task-worker-queue.ts';

describe('task worker queue projection', () => {
  it('T-MTO-Q1 queue entry creation and worker transition replay are deterministic', () => {
    const workerDefinitions = [{
      workerId: 'worker-a',
      workerType: 'local',
      supportedTaskTypes: ['shell'],
      capabilities: ['filesystem'],
      status: 'active' as const,
      maxConcurrentAssignments: 2,
    }];

    const orchestrationEntries = [
      {
        executionRunId: 'er-1',
        taskGraphId: 'tg-1',
        eventIndex: 0,
        eventType: 'worker_assignment_created' as const,
        eventDedupeKey: 'a',
        eventPayload: {
          workerId: 'worker-a',
          taskNodeId: 'node-a',
          assignmentDecisionId: 'd-1',
        },
      },
    ];

    const executionEntries = [
      {
        executionEngineRunId: 'er-1',
        executionAttemptId: 'ea-1',
        taskGraphId: 'tg-1',
        eventIndex: 0,
        eventType: 'task_node_claimed' as const,
        eventDedupeKey: 'c',
        eventPayload: {
          workerId: 'worker-a',
          taskNodeId: 'node-a',
        },
      },
      {
        executionEngineRunId: 'er-1',
        executionAttemptId: 'ea-1',
        taskGraphId: 'tg-1',
        eventIndex: 1,
        eventType: 'worker_execution_started' as const,
        eventDedupeKey: 's',
        eventPayload: {
          workerId: 'worker-a',
          taskNodeId: 'node-a',
        },
      },
      {
        executionEngineRunId: 'er-1',
        executionAttemptId: 'ea-1',
        taskGraphId: 'tg-1',
        eventIndex: 2,
        eventType: 'worker_execution_completed' as const,
        eventDedupeKey: 'x',
        eventPayload: {
          workerId: 'worker-a',
          taskNodeId: 'node-a',
        },
      },
    ];

    const first = deriveTaskWorkerQueueState({
      executionRunId: 'er-1',
      workerDefinitions,
      orchestrationEntries,
      executionEntries,
    });

    const second = deriveTaskWorkerQueueState({
      executionRunId: 'er-1',
      workerDefinitions,
      orchestrationEntries,
      executionEntries,
    });

    expect(second).toEqual(first);
    expect(first[0]?.queue[0]?.queueState).toBe('completed');
  });
});
