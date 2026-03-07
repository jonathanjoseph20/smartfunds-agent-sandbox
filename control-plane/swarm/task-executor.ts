import { withAgentContext } from '../agents/runtime/agent-context.ts';
import type { AgentExecutionEnvelope } from '../agents/runtime/agent-envelope.ts';
import { resolveTaskAgent } from '../agents/runtime/agent-runtime.ts';
import { assertAgentCanUseAdapter } from '../agents/runtime/agent-tools.ts';
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

function splitErrorCode(message: string): { code: string; detail: string } {
  const match = message.match(/^(ERR_[A-Z0-9_]+):\s*(.*)$/);
  if (!match) {
    return {
      code: 'ERR_TASK_ADAPTER_EXECUTION',
      detail: message
    };
  }

  return {
    code: match[1],
    detail: match[2] || match[1]
  };
}

function failedResult(errorCode: string, errorMessage: string, logCode: string = 'TASK_ADAPTER_EXECUTION_FAILED'): TaskResult {
  return {
    status: 'failed',
    outputs: {},
    artifacts: [],
    logs: [logCode],
    errorCode,
    errorMessage
  };
}

async function executeByAdapter(context: TaskContext, agentEnvelope?: AgentExecutionEnvelope): Promise<TaskResult> {
  try {
    if (agentEnvelope) {
      assertAgentCanUseAdapter(agentEnvelope, context.taskType);
    }

    const adapter = getAdapter(context.taskType);
    return await adapter.execute(context);
  } catch (error) {
    const parsed = splitErrorCode(toErrorMessage(error));
    return failedResult(parsed.code, parsed.detail);
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

function toAgentResolutionFailure(error: unknown): TaskResult {
  const parsed = splitErrorCode(toErrorMessage(error));
  return failedResult(parsed.code, parsed.detail, 'TASK_AGENT_RESOLUTION_FAILED');
}

export async function executePhaseTasks(input: ExecutePhaseTasksInput): Promise<PhaseTaskExecutionResult> {
  const orderedTasks = sortTasks(input.tasks);
  const executedTaskIds: string[] = [];
  let phaseContext = input.executionContext;

  for (const task of orderedTasks) {
    if (task.phase !== input.phase) {
      throw new Error(`TASK_PHASE_MISMATCH: ${task.taskId}`);
    }

    let taskExecutionContext = withExecutionIdentity(phaseContext, {
      phase: input.phase,
      taskId: task.taskId
    });

    let activeAgent: string | null = null;
    let agentEnvelope: AgentExecutionEnvelope | undefined;

    if (task.agent) {
      try {
        const runtime = resolveTaskAgent({
          taskAgent: task.agent,
          executionContext: taskExecutionContext
        });

        taskExecutionContext = withAgentContext(taskExecutionContext, runtime);
        activeAgent = runtime.activeAgent;
        agentEnvelope = runtime.agentEnvelope;
      } catch (error) {
        const result = toAgentResolutionFailure(error);
        const nextContext = applyTaskResultToContext(taskExecutionContext, result);

        input.emitEvent({
          type: 'TASK_STARTED',
          phase: input.phase,
          taskId: task.taskId,
          payload: {
            runId: input.runId,
            taskType: task.type,
            adapterId: task.type,
            agentId: null,
            inputs: task.inputs,
            task_inputs: task.inputs,
            context_snapshot: parseSerializedContext(serializeExecutionContext(taskExecutionContext))
          }
        });

        input.emitEvent({
          type: 'TASK_FAILED',
          phase: input.phase,
          taskId: task.taskId,
          payload: {
            runId: input.runId,
            taskType: task.type,
            adapterId: task.type,
            agentId: null,
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
          executionContext: nextContext
        };
      }
    }

    const taskContext = buildTaskContext(input.runId, input.phase, task, taskExecutionContext);

    input.emitEvent({
      type: 'TASK_STARTED',
      phase: input.phase,
      taskId: task.taskId,
      payload: {
        runId: input.runId,
        taskType: task.type,
        adapterId: task.type,
        agentId: activeAgent,
        inputs: task.inputs,
        task_inputs: task.inputs,
        context_snapshot: parseSerializedContext(serializeExecutionContext(taskExecutionContext))
      }
    });

    const result = task.executor
      ? runLegacyExecutor(task)
      : await executeByAdapter(taskContext, agentEnvelope);

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
          adapterId: task.type,
          agentId: activeAgent,
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
        adapterId: task.type,
        agentId: activeAgent,
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
