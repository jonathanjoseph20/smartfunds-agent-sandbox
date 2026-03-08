import type { ToolAdapter } from "./base.js";

export type WebSearchRequest = {
  query: string;
  limit: number;
  sourceClass: string;
  region?: string;
  safeMode?: boolean;
};

export type WebSearchResultItem = {
  rank: number;
  title: string;
  url: string;
  snippet?: string;
  source?: string;
};

export type WebSearchResult = {
  query: string;
  results: WebSearchResultItem[];
};

export type WebFetchRequest = {
  url: string;
};

export type WebFetchResult = {
  url: string;
  title?: string;
  text: string;
  statusCode?: number;
};

export type TwitterSearchRequest = {
  query: string;
  limit: number;
};

export type TwitterSearchResultItem = {
  rank: number;
  url: string;
  title?: string;
  snippet?: string;
  authorHint?: string;
};

export type TwitterSearchResult = {
  query: string;
  results: TwitterSearchResultItem[];
};

export type KnownToolId = "web_search" | "web_fetch" | "twitter_search";

export type ToolRegistry = {
  web_search: ToolAdapter<WebSearchRequest, WebSearchResult>;
  web_fetch: ToolAdapter<WebFetchRequest, WebFetchResult>;
  twitter_search: ToolAdapter<TwitterSearchRequest, TwitterSearchResult>;
};
