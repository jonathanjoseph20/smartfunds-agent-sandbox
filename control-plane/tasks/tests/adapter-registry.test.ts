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
      'adapter.extract_structured_data',
      'adapter.fetch_page',
      'adapter.llm_invoke',
      'adapter.search_web',
      'llm',
      'llm.generate',
      'output.write_artifact',
      'output.write_csv',
      'output.write_markdown',
      'output.write_xlsx',
      'repo',
      'shell',
      'tool.browser_fetch',
      'tool.commodity_data',
      'tool.company_extract',
      'tool.contact_extract',
      'tool.domain_classify',
      'tool.email_extract',
      'tool.list_rank',
      'tool.page_fetch',
      'tool.pdf_extract',
      'tool.reader_extract',
      'tool.table_extract',
      'tool.url_normalize',
      'tool.web_search'
    ]);
  });
});
