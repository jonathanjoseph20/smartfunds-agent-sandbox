import { load } from 'cheerio';

import type { SearchInput, SearchResult } from './search-types.ts';

const DEFAULT_MAX_RESULTS = 5;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeUrl(value: string): string {
  const trimmed = normalizeWhitespace(value);
  if (trimmed.length === 0) {
    return '';
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return trimmed;
}

function normalizeMaxResults(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MAX_RESULTS;
  }

  return Math.max(1, Math.trunc(value));
}

export async function searchWeb(
  input: SearchInput,
  options: {
    fetchImpl?: typeof fetch;
  } = {}
): Promise<SearchResult[]> {
  const query = typeof input.query === 'string' ? input.query.trim() : '';
  if (query.length === 0) {
    throw new Error('ERR_SEARCH_INPUT: query is required');
  }

  const endpoint = new URL('https://duckduckgo.com/html/');
  endpoint.searchParams.set('q', query);

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(endpoint.toString(), {
    method: 'GET',
    headers: {
      'user-agent': 'smartfunds-runtime-adapters/1.0'
    }
  });

  const html = await response.text();
  const $ = load(html);
  const maxResults = normalizeMaxResults(input.maxResults);

  const candidates: SearchResult[] = [];

  $('.result').each((_, element) => {
    if (candidates.length >= maxResults) {
      return;
    }

    const root = $(element);
    const titleNode = root.find('a.result__a').first();
    const fallbackTitleNode = root.find('a').first();
    const snippetNode = root.find('.result__snippet').first();

    const href = normalizeUrl(titleNode.attr('href') ?? fallbackTitleNode.attr('href') ?? '');
    const title = normalizeWhitespace(titleNode.text() || fallbackTitleNode.text() || '');
    const snippet = normalizeWhitespace(snippetNode.text());

    if (href.length === 0 || title.length === 0) {
      return;
    }

    candidates.push({
      title,
      url: href,
      snippet,
      rank: candidates.length + 1
    });
  });

  const sorted = [...candidates].sort((left, right) => left.rank - right.rank);
  return sorted;
}
