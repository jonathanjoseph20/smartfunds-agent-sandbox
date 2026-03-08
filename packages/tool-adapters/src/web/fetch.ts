import { htmlToText } from "../common/html-to-text.js";
import { extractTitle } from "./extract.js";
import type { ToolAdapter } from "../base.js";
import type { WebFetchRequest, WebFetchResult } from "../types.js";

type FetchLike = typeof fetch;

export async function fetchPage(
  request: WebFetchRequest,
  options: { fetchImpl?: FetchLike; maxChars?: number } = {}
): Promise<WebFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxChars = options.maxChars ?? 20_000;

  const response = await fetchImpl(request.url, {
    method: "GET",
    headers: {
      "user-agent": "smartfunds-tool-adapters/0.1"
    }
  });

  const raw = await response.text();
  const title = extractTitle(raw);
  const text = htmlToText(raw).slice(0, maxChars);

  return {
    url: request.url,
    ...(title ? { title } : {}),
    text,
    statusCode: response.status
  };
}

export function createWebFetchAdapter(
  options: { fetchImpl?: FetchLike; maxChars?: number } = {}
): ToolAdapter<WebFetchRequest, WebFetchResult> {
  return {
    toolId: "web_fetch",
    execute: async (request) => fetchPage(request, options)
  };
}

export const webFetchAdapter = createWebFetchAdapter();
