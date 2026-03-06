import { applyTaskResultToContext } from '../execution/context-merge.ts';
import { serializeExecutionContext } from '../execution/context-serializer.ts';
import { toReadonlyExecutionContext, withExecutionIdentity } from '../execution/execution-context.ts';
import type { ExecutionContext } from '../execution/context-types.ts';
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
  executionContext: ExecutionContext;
};

export type ExecutePhaseTasksInput = {
  runId: string;
  phase: SwarmPhase;
  tasks: SwarmTaskDefinition[];
  executionContext: ExecutionContext;
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

function buildTaskContext(
  runId: string,
  phase: SwarmPhase,
  task: SwarmTaskDefinition,
  executionContext: ExecutionContext
): TaskContext {
  return {
    runId,
    phase,
    taskId: task.taskId,
    taskType: task.type,
    inputs: task.inputs,
    executionContext: toReadonlyExecutionContext(executionContext)
  };
}

function parseSerializedContext(serialized: string): Record<string, unknown> {
  return JSON.parse(serialized) as Record<string, unknown>;
}

export async function executePhaseTasks(input: ExecutePhaseTasksInput): Promise<PhaseTaskExecutionResult> {
  const orderedTasks = sortTasks(input.tasks);
  const executedTaskIds: string[] = [];
  let phaseContext = input.executionContext;

  for (const task of orderedTasks) {
    if (task.phase !== input.phase) {
      throw new Error(`TASK_PHASE_MISMATCH: ${task.taskId}`);
    }

    const taskExecutionContext = withExecutionIdentity(phaseContext, {
      phase: input.phase,
      taskId: task.taskId
    });

    const taskContext = buildTaskContext(input.runId, input.phase, task, taskExecutionContext);

    input.emitEvent({
      type: 'TASK_STARTED',
      phase: input.phase,
      taskId: task.taskId,
      payload: {
        runId: input.runId,
        taskType: task.type,
        inputs: task.inputs,
        task_inputs: task.inputs,
        context_snapshot: parseSerializedContext(serializeExecutionContext(taskExecutionContext))
      }
    });

    const result = task.executor
      ? runLegacyExecutor(task)
      : await executeByAdapter(taskContext);

    const nextContext = applyTaskResultToContext(taskExecutionContext, result);

    if (result.status === 'success') {
      executedTaskIds.push(task.taskId);
      phaseContext = nextContext;
      input.emitEvent({
        type: 'TASK_COMPLETED',
        phase: input.phase,
        taskId: task.taskId,
        payload: {
          runId: input.runId,
          taskType: task.type,
          result,
          task_outputs: result.outputs,
          context_snapshot: parseSerializedContext(serializeExecutionContext(nextContext))
        }
      });
      continue;
    }

    phaseContext = nextContext;
    input.emitEvent({
      type: 'TASK_FAILED',
      phase: input.phase,
      taskId: task.taskId,
      payload: {
        runId: input.runId,
        taskType: task.type,
        result,
        task_outputs: result.outputs,
        context_snapshot: parseSerializedContext(serializeExecutionContext(nextContext)),
        error: result.errorMessage ?? 'TASK_EXECUTION_FAILED'
      }
    });

    return {
      phase: input.phase,
      status: 'failed',
      executedTaskIds,
      failedTaskId: task.taskId,
      executionContext: phaseContext
    };
  }

  return {
    phase: input.phase,
    status: 'completed',
    executedTaskIds,
    executionContext: phaseContext
  };
}
