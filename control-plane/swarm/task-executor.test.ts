import { describe, expect, it } from 'vitest';

import { executePhaseTasks, type TaskExecutionEvent } from './task-executor.ts';
import type { SwarmTaskDefinition } from './swarm-types.ts';

function createTask(taskId: string, order: number, executed: string[], shouldThrow = false): SwarmTaskDefinition {
  return {
    taskId,
    phase: 'implement',
    description: `Task ${taskId}`,
    order,
    type: 'repo',
    inputs: {
      operation: 'list_dir',
      path: '.'
    },
    executor: () => {
      executed.push(taskId);
      if (shouldThrow) {
        throw new Error(`FAIL_${taskId}`);
      }
    }
  };
}

function eventKey(event: TaskExecutionEvent): string {
  return `${event.type}:${event.taskId}`;
}

describe('task-executor', () => {
  it('emits TASK_STARTED before TASK_COMPLETED for each task', async () => {
    const events: TaskExecutionEvent[] = [];
    const executed: string[] = [];

    await executePhaseTasks({
      runId: 'run_control-plane_0001',
      phase: 'implement',
      tasks: [createTask('a', 1, executed)],
      emitEvent: (event) => {
        events.push(event);
      }
    });

    expect(executed).toEqual(['a']);
    expect(events.map(eventKey)).toEqual(['TASK_STARTED:a', 'TASK_COMPLETED:a']);
  });

  it('executes tasks in stable order by order then taskId', async () => {
    const events: TaskExecutionEvent[] = [];
    const executed: string[] = [];

    await executePhaseTasks({
      runId: 'run_control-plane_0001',
      phase: 'implement',
      tasks: [
        createTask('task-z', 2, executed),
        createTask('task-c', 1, executed),
        createTask('task-a', 1, executed)
      ],
      emitEvent: (event) => {
        events.push(event);
      }
    });

    expect(executed).toEqual(['task-a', 'task-c', 'task-z']);
    expect(events.map(eventKey)).toEqual([
      'TASK_STARTED:task-a',
      'TASK_COMPLETED:task-a',
      'TASK_STARTED:task-c',
      'TASK_COMPLETED:task-c',
      'TASK_STARTED:task-z',
      'TASK_COMPLETED:task-z'
    ]);
  });

  it('emits TASK_FAILED on executor error and stops execution', async () => {
    const events: TaskExecutionEvent[] = [];
    const executed: string[] = [];

    const result = await executePhaseTasks({
      runId: 'run_control-plane_0001',
      phase: 'implement',
      tasks: [
        createTask('task-a', 1, executed),
        createTask('task-b', 2, executed, true),
        createTask('task-c', 3, executed)
      ],
      emitEvent: (event) => {
        events.push(event);
      }
    });

    expect(result.status).toBe('failed');
    expect(result.failedTaskId).toBe('task-b');
    expect(executed).toEqual(['task-a', 'task-b']);
    expect(events.map(eventKey)).toEqual([
      'TASK_STARTED:task-a',
      'TASK_COMPLETED:task-a',
      'TASK_STARTED:task-b',
      'TASK_FAILED:task-b'
    ]);
  });

  it('produces deterministic event ordering across repeated runs', async () => {
    const first: TaskExecutionEvent[] = [];
    const second: TaskExecutionEvent[] = [];
    const executedFirst: string[] = [];
    const executedSecond: string[] = [];

    await executePhaseTasks({
      runId: 'run_control-plane_0001',
      phase: 'implement',
      tasks: [
        createTask('task-b', 1, executedFirst),
        createTask('task-a', 1, executedFirst),
        createTask('task-c', 2, executedFirst)
      ],
      emitEvent: (event) => {
        first.push(event);
      }
    });

    await executePhaseTasks({
      runId: 'run_control-plane_0001',
      phase: 'implement',
      tasks: [
        createTask('task-b', 1, executedSecond),
        createTask('task-a', 1, executedSecond),
        createTask('task-c', 2, executedSecond)
      ],
      emitEvent: (event) => {
        second.push(event);
      }
    });

    expect(first.map(eventKey)).toEqual(second.map(eventKey));
  });
});
