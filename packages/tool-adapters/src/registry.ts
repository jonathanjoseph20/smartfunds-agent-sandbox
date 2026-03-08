import type { ToolRegistry, KnownToolId } from "./types.js";
import { webSearchAdapter } from "./web/search.js";
import { webFetchAdapter } from "./web/fetch.js";
import { twitterSearchAdapter } from "./twitter/search.js";

export const toolRegistry: ToolRegistry = {
  web_search: webSearchAdapter,
  web_fetch: webFetchAdapter,
  twitter_search: twitterSearchAdapter
};

export function resolveTool<T extends KnownToolId>(toolId: T): ToolRegistry[T] {
  const tool = toolRegistry[toolId];
  if (!tool) {
    throw new Error(`ERR_TOOL_ADAPTER_NOT_FOUND: ${toolId}`);
  }
  return tool;
}
