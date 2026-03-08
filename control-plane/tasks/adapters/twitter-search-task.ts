import { searchTwitter } from '../../../packages/tool-adapters/dist/index.js';

import type { AgentTaskAdapter } from '../adapter-interface.ts';
import type { TaskResult } from '../task-result.ts';

function failedResult(errorCode: string, errorMessage: string): TaskResult {
  return {
    status: 'failed',
    outputs: {},
    artifacts: [],
    logs: ['TWITTER_SEARCH_TASK_FAILED'],
    errorCode,
    errorMessage
  };
}

export const twitterSearchTaskAdapter: AgentTaskAdapter = {
  type: 'twitter_search',
  async execute(context) {
    const query = context.inputs.query;
    const limitInput = context.inputs.limit;

    if (typeof query !== 'string' || query.trim().length === 0) {
      return failedResult('ERR_TWITTER_SEARCH_QUERY_REQUIRED', 'Twitter search query is required.');
    }

    const limit = Number.isInteger(limitInput) ? Number(limitInput) : 10;

    try {
      const result = await searchTwitter({
        query,
        limit
      });

      return {
        status: 'success',
        outputs: result,
        artifacts: [],
        logs: ['TWITTER_SEARCH_TASK_EXECUTED']
      };
    } catch (error) {
      const message = error instanceof Error && error.message.length > 0
        ? error.message
        : 'Twitter search execution failed.';
      return failedResult('ERR_TWITTER_SEARCH_FAILED', message);
    }
  }
};
