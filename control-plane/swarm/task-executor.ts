import type { SwarmPhase, SwarmTaskDefinition } from './swarm-types.ts';

export type TaskExecutionEvent = {
  type: 'TASK_STARTED' | 'TASK_COMPLETED' | 'TASK_FAILED';
  phase: SwarmPhase;
  taskId: string;
  payload?: Record<string, unknown>;
};

export type PhaseTaskExecutionResult = {
  phase: SwarmPhase;
  status: 'completed' | 'failed';
  executedTaskIds: string[];
  failedTaskId?: string;
};

export type ExecutePhaseTasksInput = {
  runId: string;
  phase: SwarmPhase;
  tasks: SwarmTaskDefinition[];
  emitEvent: (event: TaskExecutionEvent) => void;
};

function sortTasks(tasks: SwarmTaskDefinition[]): SwarmTaskDefinition[] {
  return [...tasks].sort((left, right) => {
    const orderCmp = left.order - right.order;
    if (orderCmp !== 0) {
      return orderCmp;
    }
    return left.taskId.localeCompare(right.taskId);
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'TASK_EXECUTION_FAILED';
}

export function executePhaseTasks(input: ExecutePhaseTasksInput): PhaseTaskExecutionResult {
  const orderedTasks = sortTasks(input.tasks);
  const executedTaskIds: string[] = [];

  for (const task of orderedTasks) {
    if (task.phase !== input.phase) {
      throw new Error(`TASK_PHASE_MISMATCH: ${task.taskId}`);
    }

    input.emitEvent({
      type: 'TASK_STARTED',
      phase: input.phase,
      taskId: task.taskId,
      payload: {
        runId: input.runId
      }
    });

    try {
      task.executor();
      executedTaskIds.push(task.taskId);
      input.emitEvent({
        type: 'TASK_COMPLETED',
        phase: input.phase,
        taskId: task.taskId,
        payload: {
          runId: input.runId
        }
      });
    } catch (error) {
      input.emitEvent({
        type: 'TASK_FAILED',
        phase: input.phase,
        taskId: task.taskId,
        payload: {
          runId: input.runId,
          error: toErrorMessage(error)
        }
      });

      return {
        phase: input.phase,
        status: 'failed',
        executedTaskIds,
        failedTaskId: task.taskId
      };
    }
  }

  return {
    phase: input.phase,
    status: 'completed',
    executedTaskIds
  };
}
