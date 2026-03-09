export interface SearchInput {
  query: string;
  maxResults?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  rank: number;
}
