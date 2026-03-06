import type { AgentTaskAdapter } from '../adapter-interface.ts';
import type { TaskResult } from '../task-result.ts';

function successResult(responseKey: string, responseValue: string, mode: 'mock' | 'stub'): TaskResult {
  return {
    status: 'success',
    outputs: {
      [responseKey]: responseValue,
      mode
    },
    artifacts: [],
    logs: [`LLM_TASK_EXECUTED_${mode.toUpperCase()}_MODE`]
  };
}

function failedResult(errorCode: string, errorMessage: string): TaskResult {
  return {
    status: 'failed',
    outputs: {},
    artifacts: [],
    logs: ['LLM_TASK_FAILED'],
    errorCode,
    errorMessage
  };
}

export const llmTaskAdapter: AgentTaskAdapter = {
  type: 'llm',
  async execute(context) {
    const prompt = context.inputs.prompt;
    const mockResponse = context.inputs.mockResponse;
    const responseKeyInput = context.inputs.responseKey;
    const responseKey = typeof responseKeyInput === 'string' && responseKeyInput.trim().length > 0
      ? responseKeyInput
      : 'response';

    if (typeof mockResponse === 'string') {
      return successResult(responseKey, mockResponse, 'mock');
    }

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return failedResult('ERR_LLM_PROMPT_REQUIRED', 'LLM prompt is required when mockResponse is not provided.');
    }

    const modelInput = context.inputs.model;
    const model = typeof modelInput === 'string' && modelInput.trim().length > 0 ? modelInput : 'deterministic-stub-model';
    const stub = `stub:${model}:${prompt.trim()}`;

    return successResult(responseKey, stub, 'stub');
  }
};
