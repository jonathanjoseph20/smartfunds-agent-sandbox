import { searchWeb } from '../../../packages/tool-adapters/dist/index.js';

import type { AgentTaskAdapter } from '../adapter-interface.ts';
import type { TaskResult } from '../task-result.ts';

function failedResult(errorCode: string, errorMessage: string): TaskResult {
  return {
    status: 'failed',
    outputs: {},
    artifacts: [],
    logs: ['WEB_SEARCH_TASK_FAILED'],
    errorCode,
    errorMessage
  };
}

export const webSearchTaskAdapter: AgentTaskAdapter = {
  type: 'web_search',
  async execute(context) {
    const query = context.inputs.query;
    const limitInput = context.inputs.limit;
    const sourceClass = context.inputs.sourceClass;

    if (typeof query !== 'string' || query.trim().length === 0) {
      return failedResult('ERR_WEB_SEARCH_QUERY_REQUIRED', 'Web search query is required.');
    }

    if (typeof sourceClass !== 'string' || sourceClass.trim().length === 0) {
      return failedResult('ERR_WEB_SEARCH_SOURCE_CLASS_REQUIRED', 'Web search sourceClass is required.');
    }

    const limit = Number.isInteger(limitInput) ? Number(limitInput) : 10;

    try {
      const result = await searchWeb({
        query,
        limit,
        sourceClass,
        ...(typeof context.inputs.region === 'string' ? { region: context.inputs.region } : {}),
        ...(typeof context.inputs.safeMode === 'boolean' ? { safeMode: context.inputs.safeMode } : {})
      });

      return {
        status: 'success',
        outputs: result,
        artifacts: [],
        logs: ['WEB_SEARCH_TASK_EXECUTED']
      };
    } catch (error) {
      const message = error instanceof Error && error.message.length > 0
        ? error.message
        : 'Web search execution failed.';
      return failedResult('ERR_WEB_SEARCH_FAILED', message);
    }
  }
};
