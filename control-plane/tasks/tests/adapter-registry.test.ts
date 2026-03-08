import { describe, expect, it } from 'vitest';

import { getAdapter, listRegisteredAdapters } from '../adapter-registry.ts';
import {
  llmTaskAdapter,
  repoTaskAdapter,
  shellTaskAdapter,
  twitterSearchTaskAdapter,
  webFetchTaskAdapter,
  webSearchTaskAdapter
} from '../adapters/index.ts';

describe('task adapter registry', () => {
  it('returns llm adapter for llm task type', () => {
    expect(getAdapter('llm')).toBe(llmTaskAdapter);
  });

  it('returns shell adapter for shell task type', () => {
    expect(getAdapter('shell')).toBe(shellTaskAdapter);
  });

  it('returns repo adapter for repo task type', () => {
    expect(getAdapter('repo')).toBe(repoTaskAdapter);
  });

  it('returns web_search adapter for web_search task type', () => {
    expect(getAdapter('web_search')).toBe(webSearchTaskAdapter);
  });

  it('returns web_fetch adapter for web_fetch task type', () => {
    expect(getAdapter('web_fetch')).toBe(webFetchTaskAdapter);
  });

  it('returns twitter_search adapter for twitter_search task type', () => {
    expect(getAdapter('twitter_search')).toBe(twitterSearchTaskAdapter);
  });

  it('throws deterministic error for unknown adapter type', () => {
    expect(() => getAdapter('unknown' as 'llm')).toThrow('ERR_TASK_ADAPTER_NOT_FOUND: unknown');
  });

  it('lists adapters in stable deterministic order', () => {
    expect(listRegisteredAdapters().map((entry) => entry.type)).toEqual([
      'llm',
      'repo',
      'shell',
      'twitter_search',
      'web_fetch',
      'web_search'
    ]);
  });
});
