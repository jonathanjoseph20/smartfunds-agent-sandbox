function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toDomain(urlString: string): string {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function stripTags(value: string): string {
  return normalizeWhitespace(value.replace(/<[^>]+>/g, ' '));
}

function extractCandidatesFromHtml(html: string): Array<{ title: string; url: string; snippet: string }> {
  const resultBlockRegex = /<div[^>]*class=["'][^"']*result[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  const blocks = [...html.matchAll(resultBlockRegex)].map((match) => match[1]);

  const candidates = blocks.map((block) => {
    const urlMatch = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
    const titleMatch = block.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = block.match(/<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/a>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);

    return {
      title: stripTags(titleMatch?.[1] ?? ''),
      url: normalizeWhitespace(urlMatch?.[1] ?? ''),
      snippet: stripTags(snippetMatch?.[2] ?? '')
    };
  });

  const fallbackAnchors = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((entry) => ({
      title: stripTags(entry[2] ?? ''),
      url: normalizeWhitespace(entry[1] ?? ''),
      snippet: ''
    }));

  return (candidates.length > 0 ? candidates : fallbackAnchors)
    .filter((entry) => entry.url.length > 0 && entry.title.length > 0);
}

export function normalizeWebSearchResults(input: {
  query: string;
  candidates: Array<{ title: string; url: string; snippet: string }>;
  limit?: number;
}): {
  query: string;
  results: Array<{
    rank: number;
    title: string;
    url: string;
    snippet: string;
    domain: string;
  }>;
} {
  const normalized = input.candidates
    .map((candidate) => ({
      title: normalizeWhitespace(candidate.title),
      url: normalizeWhitespace(candidate.url),
      snippet: normalizeWhitespace(candidate.snippet),
      domain: toDomain(candidate.url)
    }))
    .filter((candidate) => candidate.url.length > 0 && candidate.title.length > 0)
    .map((candidate, index) => ({
      rank: index + 1,
      ...candidate
    }));

  const limited = typeof input.limit === 'number' && input.limit > 0
    ? normalized.slice(0, input.limit)
    : normalized;

  const stable = [...limited].sort((left, right) => left.rank - right.rank);

  return {
    query: input.query,
    results: stable
  };
}

export async function webSearch(input: {
  query: string;
  region?: string;
  safeMode?: boolean;
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const endpoint = new URL('https://duckduckgo.com/html/');
  endpoint.searchParams.set('q', input.query);
  if (input.region) {
    endpoint.searchParams.set('kl', input.region);
  }
  if (input.safeMode) {
    endpoint.searchParams.set('kp', '1');
  }

  const response = await fetchImpl(endpoint.toString(), {
    method: 'GET',
    headers: {
      'user-agent': 'smartfunds-runtime-tools/1.0'
    }
  });

  const html = await response.text();
  return normalizeWebSearchResults({
    query: input.query,
    candidates: extractCandidatesFromHtml(html),
    limit: input.limit
  }) as unknown as Record<string, unknown>;
}
