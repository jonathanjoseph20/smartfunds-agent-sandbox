import { describe, expect, it } from 'vitest';

import { executeTool, listToolAdapters } from '../tool-registry.ts';

describe('runtime tool registry', () => {
  it('T-T5 keeps adapters listed in stable sorted order', () => {
    const keys = listToolAdapters().map((entry) => `${entry.toolId}:${entry.action}`);
    expect(keys).toEqual([
      'browser_fetch:fetch',
      'commodity_data:extract',
      'company_extract:extract',
      'contact_extract:extract',
      'domain_classify:classify',
      'email_extract:extract',
      'list_rank:rank',
      'page_fetch:fetch',
      'pdf_extract:extract',
      'reader_extract:extract',
      'table_extract:extract',
      'url_normalize:normalize',
      'web_search:search'
    ]);
  });

  it('T-T6 returns deterministic error when adapter is missing', async () => {
    const response = await executeTool({
      toolId: 'missing',
      action: 'x',
      input: {}
    });

    expect(response).toEqual({
      toolId: 'missing',
      action: 'x',
      ok: false,
      data: null,
      errors: ['ERR_TOOL_NOT_FOUND: missing:x']
    });
  });
});
