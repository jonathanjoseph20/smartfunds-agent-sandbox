import { describe, expect, it } from 'vitest';

import { createExecutionContext } from '../../execution/execution-context.ts';
import { llmTaskAdapter } from '../adapters/llm-task.ts';
import type { TaskContext } from '../task-context.ts';

function context(inputs: Record<string, unknown>): TaskContext {
  return {
    runId: 'run_control-plane_0001',
    phase: 'setup',
    taskId: 'task_llm',
    taskType: 'llm',
    inputs,
    executionContext: createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'setup',
      taskId: 'task_llm'
    })
  };
}

describe('llm task adapter', () => {
  it('returns mock response in deterministic success shape', async () => {
    const result = await llmTaskAdapter.execute(context({
      prompt: 'ignored',
      mockResponse: 'mock-value',
      responseKey: 'answer'
    }));

    expect(result).toEqual({
      status: 'success',
      outputs: {
        answer: 'mock-value',
        mode: 'mock'
      },
      artifacts: [],
      logs: ['LLM_TASK_EXECUTED_MOCK_MODE']
    });
  });

  it('returns deterministic stub output when prompt provided without mock response', async () => {
    const first = await llmTaskAdapter.execute(context({ prompt: 'hello', model: 'model-a' }));
    const second = await llmTaskAdapter.execute(context({ prompt: 'hello', model: 'model-a' }));

    expect(first).toEqual(second);
    expect(first).toEqual({
      status: 'success',
      outputs: {
        response: 'stub:model-a:hello',
        mode: 'stub'
      },
      artifacts: [],
      logs: ['LLM_TASK_EXECUTED_STUB_MODE']
    });
  });

  it('returns deterministic failure when prompt and mock response are missing', async () => {
    const result = await llmTaskAdapter.execute(context({}));

    expect(result).toEqual({
      status: 'failed',
      outputs: {},
      artifacts: [],
      logs: ['LLM_TASK_FAILED'],
      errorCode: 'ERR_LLM_PROMPT_REQUIRED',
      errorMessage: 'LLM prompt is required when mockResponse is not provided.'
    });
  });

  it('routes gateway mode through llm gateway structured generation', async () => {
    const result = await llmTaskAdapter.execute(context({
      gateway: true,
      prompt: 'Return any valid object'
    }));

    expect(result.status).toBe('success');
    expect(result.logs).toEqual(['LLM_TASK_EXECUTED_GATEWAY_MODE']);
    expect(result.outputs.mode).toBe('gateway');
    expect(result.outputs.response).toEqual({ ok: true });
  });
});
