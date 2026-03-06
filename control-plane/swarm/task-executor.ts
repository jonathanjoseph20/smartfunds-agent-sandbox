import { getAdapter } from '../tasks/adapter-registry.ts';
import type { TaskContext } from '../tasks/task-context.ts';
import type { TaskResult } from '../tasks/task-result.ts';
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

function failedResult(errorCode: string, errorMessage: string): TaskResult {
  return {
    status: 'failed',
    outputs: {},
    artifacts: [],
    logs: ['TASK_ADAPTER_EXECUTION_FAILED'],
    errorCode,
    errorMessage
  };
}

async function executeByAdapter(context: TaskContext): Promise<TaskResult> {
  try {
    const adapter = getAdapter(context.taskType);
    return await adapter.execute(context);
  } catch (error) {
    return failedResult('ERR_TASK_ADAPTER_EXECUTION', toErrorMessage(error));
  }
}

function runLegacyExecutor(task: SwarmTaskDefinition): TaskResult {
  try {
    task.executor?.();
    return {
      status: 'success',
      outputs: {},
      artifacts: [],
      logs: ['TASK_EXECUTOR_EXECUTED']
    };
  } catch (error) {
    return failedResult('ERR_TASK_EXECUTOR_FAILED', toErrorMessage(error));
  }
}

function buildTaskContext(runId: string, phase: SwarmPhase, task: SwarmTaskDefinition): TaskContext {
  return {
    runId,
    phase,
    taskId: task.taskId,
    taskType: task.type,
    inputs: task.inputs,
    executionContext: task.executionContext ?? {}
  };
}

export async function executePhaseTasks(input: ExecutePhaseTasksInput): Promise<PhaseTaskExecutionResult> {
  const orderedTasks = sortTasks(input.tasks);
  const executedTaskIds: string[] = [];

  for (const task of orderedTasks) {
    if (task.phase !== input.phase) {
      throw new Error(`TASK_PHASE_MISMATCH: ${task.taskId}`);
    }

    const taskContext = buildTaskContext(input.runId, input.phase, task);

    input.emitEvent({
      type: 'TASK_STARTED',
      phase: input.phase,
      taskId: task.taskId,
      payload: {
        runId: input.runId,
        taskType: task.type,
        inputs: task.inputs
      }
    });

    const result = task.executor
      ? runLegacyExecutor(task)
      : await executeByAdapter(taskContext);

    if (result.status === 'success') {
      executedTaskIds.push(task.taskId);
      input.emitEvent({
        type: 'TASK_COMPLETED',
        phase: input.phase,
        taskId: task.taskId,
        payload: {
          runId: input.runId,
          taskType: task.type,
          result
        }
      });
      continue;
    }

    input.emitEvent({
      type: 'TASK_FAILED',
      phase: input.phase,
      taskId: task.taskId,
      payload: {
        runId: input.runId,
        taskType: task.type,
        result,
        error: result.errorMessage ?? 'TASK_EXECUTION_FAILED'
      }
    });

    return {
      phase: input.phase,
      status: 'failed',
      executedTaskIds,
      failedTaskId: task.taskId
    };
  }

  return {
    phase: input.phase,
    status: 'completed',
    executedTaskIds
  };
}
