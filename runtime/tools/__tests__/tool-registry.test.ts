import { describe, expect, it } from 'vitest';

import { executeTool, listToolAdapters } from '../tool-registry.ts';

describe('runtime tool registry', () => {
  it('T-T5 keeps adapters listed in stable sorted order', () => {
    const keys = listToolAdapters().map((entry) => `${entry.toolId}:${entry.action}`);
    expect(keys).toEqual([
      'page_fetch:fetch',
      'reader_extract:extract',
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
