const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid'
]);

function normalizePath(pathname: string): string {
  if (pathname.length === 0) {
    return '/';
  }

  const normalized = pathname.replace(/\/{2,}/g, '/');
  if (normalized !== '/' && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (value.length === 0) {
    return '';
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return '';
  }

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';
  parsed.pathname = normalizePath(parsed.pathname);

  const kept: Array<[string, string]> = [];
  parsed.searchParams.forEach((paramValue, paramName) => {
    const key = paramName.toLowerCase();
    if (!TRACKING_PARAMS.has(key)) {
      kept.push([key, paramValue.trim()]);
    }
  });

  kept.sort((left, right) => {
    const keyCompare = left[0].localeCompare(right[0]);
    if (keyCompare !== 0) {
      return keyCompare;
    }
    return left[1].localeCompare(right[1]);
  });

  parsed.search = '';
  for (const [key, paramValue] of kept) {
    parsed.searchParams.append(key, paramValue);
  }

  return parsed.toString();
}

export function extractDomain(input: string): string {
  const normalized = normalizeUrl(input);
  if (normalized.length === 0) {
    return '';
  }

  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function dedupeUrls(urls: string[]): string[] {
  const unique = new Set<string>();
  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (normalized.length > 0) {
      unique.add(normalized);
    }
  }

  return [...unique].sort((left, right) => left.localeCompare(right));
}

export function urlNormalize(input: { url?: string; urls?: string[] }): Record<string, unknown> {
  const single = typeof input.url === 'string' ? normalizeUrl(input.url) : '';
  const list = Array.isArray(input.urls)
    ? dedupeUrls(input.urls.filter((entry): entry is string => typeof entry === 'string'))
    : [];

  if (single.length > 0) {
    return {
      normalizedUrl: single,
      domain: extractDomain(single)
    };
  }

  return {
    urls: list.map((url) => ({
      source: url,
      domain: extractDomain(url)
    }))
  };
}
