import type { ToolAdapter, ToolRequest, ToolResponse } from './types.ts';
import { pageFetch } from './adapters/page-fetch.ts';
import { readerExtract } from './adapters/reader-extract.ts';
import { webSearch } from './adapters/web-search.ts';

const adapters: readonly ToolAdapter[] = [
  {
    toolId: 'web_search',
    action: 'search',
    async execute(input) {
      const query = typeof input.query === 'string' ? input.query : '';
      if (query.trim().length === 0) {
        throw new Error('ERR_TOOL_INPUT: web_search query is required');
      }

      return webSearch({
        query,
        region: typeof input.region === 'string' ? input.region : undefined,
        safeMode: input.safeMode === true,
        limit: typeof input.limit === 'number' ? input.limit : undefined
      });
    }
  },
  {
    toolId: 'page_fetch',
    action: 'fetch',
    async execute(input) {
      const url = typeof input.url === 'string' ? input.url : '';
      if (url.trim().length === 0) {
        throw new Error('ERR_TOOL_INPUT: page_fetch url is required');
      }
      return pageFetch({ url });
    }
  },
  {
    toolId: 'reader_extract',
    action: 'extract',
    async execute(input) {
      const html = typeof input.html === 'string' ? input.html : '';
      if (html.trim().length === 0) {
        throw new Error('ERR_TOOL_INPUT: reader_extract html is required');
      }
      return readerExtract({ html });
    }
  }
] as const;

const registry = new Map<string, ToolAdapter>(
  adapters.map((adapter) => [`${adapter.toolId}:${adapter.action}`, adapter])
);

export function listToolAdapters(): ToolAdapter[] {
  return [...adapters].sort((left, right) => {
    const keyLeft = `${left.toolId}:${left.action}`;
    const keyRight = `${right.toolId}:${right.action}`;
    return keyLeft.localeCompare(keyRight);
  });
}

export async function executeTool(request: ToolRequest): Promise<ToolResponse> {
  const key = `${request.toolId}:${request.action}`;
  const adapter = registry.get(key);
  if (!adapter) {
    return {
      toolId: request.toolId,
      action: request.action,
      ok: false,
      data: null,
      errors: [`ERR_TOOL_NOT_FOUND: ${key}`]
    };
  }

  try {
    const data = await adapter.execute(request.input);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      data,
      errors: []
    };
  } catch (error) {
    return {
      toolId: request.toolId,
      action: request.action,
      ok: false,
      data: null,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}
