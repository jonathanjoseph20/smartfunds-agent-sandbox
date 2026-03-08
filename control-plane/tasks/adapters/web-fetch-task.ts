import { fetchPage } from '../../../packages/tool-adapters/dist/index.js';

import type { AgentTaskAdapter } from '../adapter-interface.ts';
import type { TaskResult } from '../task-result.ts';

function failedResult(errorCode: string, errorMessage: string): TaskResult {
  return {
    status: 'failed',
    outputs: {},
    artifacts: [],
    logs: ['WEB_FETCH_TASK_FAILED'],
    errorCode,
    errorMessage
  };
}

export const webFetchTaskAdapter: AgentTaskAdapter = {
  type: 'web_fetch',
  async execute(context) {
    const url = context.inputs.url;
    if (typeof url !== 'string' || url.trim().length === 0) {
      return failedResult('ERR_WEB_FETCH_URL_REQUIRED', 'Web fetch url is required.');
    }

    try {
      const result = await fetchPage({ url });
      return {
        status: 'success',
        outputs: result,
        artifacts: [],
        logs: ['WEB_FETCH_TASK_EXECUTED']
      };
    } catch (error) {
      const message = error instanceof Error && error.message.length > 0
        ? error.message
        : 'Web fetch execution failed.';
      return failedResult('ERR_WEB_FETCH_FAILED', message);
    }
  }
};
