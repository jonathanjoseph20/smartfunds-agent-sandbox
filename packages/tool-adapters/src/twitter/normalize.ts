import { assignDeterministicRanks } from "../common/ranking.js";
import { isTwitterUrl, normalizeUrl } from "../common/urls.js";
import { extractAuthorHint } from "./extract.js";
import type { TwitterSearchResultItem } from "../types.js";

type Candidate = {
  url: string;
  title?: string;
  snippet?: string;
};

export function normalizeTwitterSearchResults(candidates: Candidate[], limit: number): TwitterSearchResultItem[] {
  const deduped = new Map<string, Candidate>();

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate.url);
    if (!normalized || !isTwitterUrl(normalized)) {
      continue;
    }

    if (!deduped.has(normalized)) {
      deduped.set(normalized, {
        url: normalized,
        ...(candidate.title ? { title: candidate.title.trim() } : {}),
        ...(candidate.snippet ? { snippet: candidate.snippet.trim() } : {})
      });
    }
  }

  const sorted = [...deduped.values()]
    .sort((left, right) => left.url.localeCompare(right.url))
    .slice(0, Math.max(0, limit));

  return assignDeterministicRanks(sorted.map((entry) => ({
    ...entry,
    ...(extractAuthorHint(entry.url) ? { authorHint: extractAuthorHint(entry.url) } : {})
  })));
}
