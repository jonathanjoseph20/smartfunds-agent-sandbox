import { afterEach, describe, expect, it, vi } from 'vitest';

import { createExecutionContext } from '../../execution/execution-context.ts';
import { twitterSearchTaskAdapter } from '../adapters/twitter-search-task.ts';
import { webFetchTaskAdapter } from '../adapters/web-fetch-task.ts';
import { webSearchTaskAdapter } from '../adapters/web-search-task.ts';
import type { TaskContext } from '../task-context.ts';

function context(taskType: TaskContext['taskType'], inputs: Record<string, unknown>): TaskContext {
  return {
    runId: 'run_control-plane_0001',
    phase: 'implement',
    taskId: `task_${taskType}`,
    taskType,
    inputs,
    executionContext: createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'implement',
      taskId: `task_${taskType}`
    })
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tool task adapters', () => {
  it('executes web_search with deterministic normalized output', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      status: 200,
      text: async () => '<a href="https://example.com/b">B</a><a href="https://example.com/a">A</a>'
    } as Response)));

    const result = await webSearchTaskAdapter.execute(context('web_search', {
      query: 'rwa',
      limit: 10,
      sourceClass: 'market'
    }));

    expect(result).toMatchObject({
      status: 'success',
      outputs: {
        query: 'rwa',
        results: [
          { rank: 1, title: 'A', url: 'https://example.com/a' },
          { rank: 2, title: 'B', url: 'https://example.com/b' }
        ]
      },
      logs: ['WEB_SEARCH_TASK_EXECUTED']
    });
  });

  it('executes web_fetch with deterministic extraction', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      status: 200,
      text: async () => '<title>Alpha</title><p>Hello world</p>'
    } as Response)));

    const result = await webFetchTaskAdapter.execute(context('web_fetch', {
      url: 'https://example.com/page'
    }));

    expect(result).toMatchObject({
      status: 'success',
      outputs: {
        url: 'https://example.com/page',
        title: 'Alpha',
        text: 'Alpha Hello world',
        statusCode: 200
      },
      logs: ['WEB_FETCH_TASK_EXECUTED']
    });
  });

  it('executes twitter_search with deterministic normalization', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      status: 200,
      text: async () => '<a href="https://x.com/user/status/1">Post</a><a href="https://example.com/1">No</a>'
    } as Response)));

    const result = await twitterSearchTaskAdapter.execute(context('twitter_search', {
      query: 'rwa',
      limit: 10
    }));

    expect(result).toMatchObject({
      status: 'success',
      outputs: {
        query: 'rwa',
        results: [
          {
            rank: 1,
            url: 'https://x.com/user/status/1',
            title: 'Post',
            authorHint: 'user'
          }
        ]
      },
      logs: ['TWITTER_SEARCH_TASK_EXECUTED']
    });
  });
});
