import { normalizeWebSearchResults } from "./normalize.js";
import type { ToolAdapter } from "../base.js";
import type { WebSearchRequest, WebSearchResult } from "../types.js";

type FetchLike = typeof fetch;

type SearchResultCandidate = {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
};

function extractCandidatesFromHtml(html: string): SearchResultCandidate[] {
  const anchors = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  return anchors.map((entry) => {
    const rawUrl = entry[1] ?? "";
    const rawTitle = (entry[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return {
      title: rawTitle,
      url: rawUrl
    };
  });
}

export async function searchWeb(
  request: WebSearchRequest,
  options: { fetchImpl?: FetchLike } = {}
): Promise<WebSearchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = new URL("https://duckduckgo.com/html/");
  endpoint.searchParams.set("q", request.query);
  if (request.region) {
    endpoint.searchParams.set("kl", request.region);
  }
  if (request.safeMode === true) {
    endpoint.searchParams.set("kp", "1");
  }

  const response = await fetchImpl(endpoint.toString(), {
    method: "GET",
    headers: {
      "user-agent": "smartfunds-tool-adapters/0.1"
    }
  });

  const html = await response.text();
  const candidates = extractCandidatesFromHtml(html);

  return {
    query: request.query,
    results: normalizeWebSearchResults(candidates, request.limit)
  };
}

export function createWebSearchAdapter(
  options: { fetchImpl?: FetchLike } = {}
): ToolAdapter<WebSearchRequest, WebSearchResult> {
  return {
    toolId: "web_search",
    execute: async (request) => searchWeb(request, options)
  };
}

export const webSearchAdapter = createWebSearchAdapter();
