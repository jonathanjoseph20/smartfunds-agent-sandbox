import fetch from 'node-fetch';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

import type { PageContent } from './browser-types.ts';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export async function fetchPage(
  input: { url: string },
  options: {
    fetchImpl?: typeof fetch;
  } = {}
): Promise<PageContent> {
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  if (url.length === 0) {
    throw new Error('ERR_BROWSER_INPUT: url is required');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'user-agent': 'smartfunds-runtime-adapters/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`ERR_BROWSER_FETCH: status=${response.status}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const title = normalizeWhitespace(article?.title ?? dom.window.document.title ?? '');
  const textCandidate = article?.content
    ? article.content.replace(/<[^>]+>/g, ' ')
    : (article?.textContent ?? dom.window.document.body?.textContent ?? '');
  const text = normalizeWhitespace(textCandidate);

  return {
    url,
    title,
    text
  };
}
