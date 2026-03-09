import { describe, expect, it } from 'vitest';

import { fetchPage } from './browser-adapter.ts';

describe('browser adapter', () => {
  it('T-B1 parses title/text and normalizes whitespace deterministically', async () => {
    const html = [
      '<html><head><title> Example Page </title></head>',
      '<body><main><article><h1>Example Page</h1><p>Alpha   beta</p><p>Gamma</p></article></main></body></html>'
    ].join('');

    const page = await fetchPage(
      { url: 'https://example.com/a' },
      {
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => html
        } as Response)
      }
    );

    expect(page).toEqual({
      url: 'https://example.com/a',
      title: 'Example Page',
      text: 'Alpha beta Gamma'
    });
  });

  it('T-B2 fails on non-ok response', async () => {
    await expect(fetchPage(
      { url: 'https://example.com/fail' },
      {
        fetchImpl: async () => ({
          ok: false,
          status: 503,
          text: async () => ''
        } as Response)
      }
    )).rejects.toThrow('ERR_BROWSER_FETCH: status=503');
  });

  it('T-B3 validates url input', async () => {
    await expect(fetchPage({ url: '   ' })).rejects.toThrow('ERR_BROWSER_INPUT: url is required');
  });
});
