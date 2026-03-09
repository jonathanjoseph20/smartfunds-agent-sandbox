import { describe, expect, it } from 'vitest';

import { searchWeb } from './search-adapter.ts';

describe('search adapter', () => {
  it('T-S1 parses and normalizes schema with deterministic rank ordering', async () => {
    const html = [
      '<html><body>',
      '<div class="result"><a class="result__a" href="https://z.example">  Zed  </a><div class="result__snippet">  z snippet  </div></div>',
      '<div class="result"><a class="result__a" href="https://a.example"> Alpha </a><div class="result__snippet"> a snippet </div></div>',
      '</body></html>'
    ].join('');

    const results = await searchWeb(
      { query: 'alpha zed', maxResults: 10 },
      {
        fetchImpl: async () => ({
          text: async () => html
        } as Response)
      }
    );

    expect(results).toEqual([
      { title: 'Zed', url: 'https://z.example', snippet: 'z snippet', rank: 1 },
      { title: 'Alpha', url: 'https://a.example', snippet: 'a snippet', rank: 2 }
    ]);
  });

  it('T-S2 enforces maxResults and keeps sorted output', async () => {
    const html = [
      '<html><body>',
      '<div class="result"><a class="result__a" href="https://one.example">One</a></div>',
      '<div class="result"><a class="result__a" href="https://two.example">Two</a></div>',
      '</body></html>'
    ].join('');

    const results = await searchWeb(
      { query: 'limited', maxResults: 1 },
      {
        fetchImpl: async () => ({
          text: async () => html
        } as Response)
      }
    );

    expect(results).toEqual([
      { title: 'One', url: 'https://one.example', snippet: '', rank: 1 }
    ]);
  });

  it('T-S3 validates query input', async () => {
    await expect(searchWeb({ query: '   ' })).rejects.toThrow('ERR_SEARCH_INPUT: query is required');
  });
});
