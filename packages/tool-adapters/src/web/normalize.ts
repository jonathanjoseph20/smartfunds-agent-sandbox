import { assignDeterministicRanks } from "../common/ranking.js";
import { normalizeUrl } from "../common/urls.js";
import type { WebSearchResultItem } from "../types.js";

type Candidate = {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
};

export function normalizeWebSearchResults(candidates: Candidate[], limit: number): WebSearchResultItem[] {
  const deduped = new Map<string, Candidate>();

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate.url);
    if (!normalized) {
      continue;
    }

    if (!deduped.has(normalized)) {
      deduped.set(normalized, {
        title: candidate.title.trim(),
        url: normalized,
        ...(candidate.snippet ? { snippet: candidate.snippet.trim() } : {}),
        ...(candidate.source ? { source: candidate.source.trim() } : {})
      });
    }
  }

  const sorted = [...deduped.values()]
    .filter((entry) => entry.title.length > 0)
    .sort((left, right) => {
      const urlCmp = left.url.localeCompare(right.url);
      if (urlCmp !== 0) {
        return urlCmp;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, Math.max(0, limit));

  return assignDeterministicRanks(sorted);
}
