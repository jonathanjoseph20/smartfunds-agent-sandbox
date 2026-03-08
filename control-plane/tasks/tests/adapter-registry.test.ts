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

  it('returns runtime adapter for llm.generate task type', () => {
    expect(getAdapter('llm.generate').type).toBe('llm.generate');
  });

  it('throws deterministic error for unknown adapter type', () => {
    expect(() => getAdapter('unknown' as 'llm')).toThrow('ERR_TASK_ADAPTER_NOT_FOUND: unknown');
  });

  it('lists adapters in stable deterministic order', () => {
    expect(listRegisteredAdapters().map((entry) => entry.type)).toEqual([
      'llm',
      'llm.generate',
      'output.write_artifact',
      'output.write_csv',
      'output.write_xlsx',
      'repo',
      'shell',
      'tool.page_fetch',
      'tool.reader_extract',
      'tool.web_search'
    ]);
  });
});
