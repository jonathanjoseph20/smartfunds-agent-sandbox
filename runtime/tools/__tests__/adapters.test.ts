import { describe, expect, it } from 'vitest';

import { pageFetch } from '../adapters/page-fetch.ts';
import { readerExtract } from '../adapters/reader-extract.ts';
import { normalizeWebSearchResults, webSearch } from '../adapters/web-search.ts';

describe('runtime tools adapters', () => {
  it('T-T1 normalizes web search results with stable rank ordering', () => {
    const normalized = normalizeWebSearchResults({
      query: 'smart funds',
      candidates: [
        { title: ' B ', url: 'https://b.example/path', snippet: ' second ' },
        { title: ' A ', url: 'https://a.example/path', snippet: ' first ' }
      ]
    });

    expect(normalized.query).toBe('smart funds');
    expect(normalized.results.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(normalized.results[0].domain).toBe('b.example');
    expect(normalized.results[1].domain).toBe('a.example');
  });

  it('T-T2 returns stable shape for page fetch', async () => {
    const result = await pageFetch({
      url: 'https://example.com',
      fetchImpl: async () => ({
        status: 200,
        url: 'https://example.com/final',
        headers: { get: () => 'text/html; charset=utf-8' },
        text: async () => '<html>\r\n<body>x</body>\r\n</html>'
      } as unknown as Response)
    });

    expect(result).toEqual({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      finalUrl: 'https://example.com/final',
      html: '<html>\n<body>x</body>\n</html>'
    });
  });

  it('T-T3 cleans reader extraction output by removing nav/scripts and normalizing whitespace', () => {
    const result = readerExtract({
      html: [
        '<html><head><title>  Demo Title </title><script>bad()</script></head>',
        '<body><nav>menu</nav><main><p>Hello   world</p><p>Next line</p></main></body></html>'
      ].join('')
    });

    expect(result).toEqual({
      title: 'Demo Title',
      body: 'Hello world\nNext line'
    });
  });

  it('T-T4 web search adapter output is deterministic with mocked network', async () => {
    const html = [
      '<html><body>',
      '<div class="result"><a href="https://z.example/1">Zed</a></div>',
      '<div class="result"><a href="https://a.example/1">Alpha</a></div>',
      '</body></html>'
    ].join('');

    const result = await webSearch({
      query: 'q',
      fetchImpl: async () => ({
        text: async () => html
      } as unknown as Response)
    });

    const rows = (result.results as Array<{ rank: number; title: string; url: string }>);
    expect(rows).toHaveLength(2);
    expect(rows.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(rows[0].url).toBe('https://z.example/1');
    expect(rows[1].url).toBe('https://a.example/1');
  });
});
