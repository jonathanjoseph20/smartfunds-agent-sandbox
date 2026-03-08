import type { ToolAdapter } from "../base.js";
import type { TwitterSearchRequest, TwitterSearchResult } from "../types.js";
import { searchWeb } from "../web/search.js";
import { normalizeTwitterSearchResults } from "./normalize.js";

export function buildTwitterSearchQuery(query: string): string {
  return `site:x.com OR site:twitter.com ${query}`.trim();
}

export async function searchTwitter(
  request: TwitterSearchRequest,
  options: { fetchImpl?: typeof fetch } = {}
): Promise<TwitterSearchResult> {
  const constrainedQuery = buildTwitterSearchQuery(request.query);
  const web = await searchWeb({
    query: constrainedQuery,
    limit: request.limit,
    sourceClass: "twitter"
  }, options);

  return {
    query: request.query,
    results: normalizeTwitterSearchResults(
      web.results.map((item) => ({
        url: item.url,
        ...(item.title ? { title: item.title } : {}),
        ...(item.snippet ? { snippet: item.snippet } : {})
      })),
      request.limit
    )
  };
}

export function createTwitterSearchAdapter(
  options: { fetchImpl?: typeof fetch } = {}
): ToolAdapter<TwitterSearchRequest, TwitterSearchResult> {
  return {
    toolId: "twitter_search",
    execute: async (request) => searchTwitter(request, options)
  };
}

export const twitterSearchAdapter = createTwitterSearchAdapter();
