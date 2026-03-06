import { describe, expect, it } from 'vitest';

import { getAdapter, listRegisteredAdapters } from '../adapter-registry.ts';
import { llmTaskAdapter, repoTaskAdapter, shellTaskAdapter } from '../adapters/index.ts';

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

  it('throws deterministic error for unknown adapter type', () => {
    expect(() => getAdapter('unknown' as 'llm')).toThrow('ERR_TASK_ADAPTER_NOT_FOUND: unknown');
  });

  it('lists adapters in stable deterministic order', () => {
    expect(listRegisteredAdapters().map((entry) => entry.type)).toEqual(['llm', 'repo', 'shell']);
  });
});
