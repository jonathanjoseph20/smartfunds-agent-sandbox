import type { ToolAdapter, ToolRequest, ToolResponse } from './types.ts';
import { browserFetch } from './adapters/browser-fetch.ts';
import { commodityData } from './adapters/commodity-data.ts';
import { companyExtract } from './adapters/company-extract.ts';
import { contactExtract } from './adapters/contact-extract.ts';
import { domainClassify } from './adapters/domain-classify.ts';
import { emailExtract } from './adapters/email-extract.ts';
import { listRank } from './adapters/list-rank.ts';
import { pageFetch } from './adapters/page-fetch.ts';
import { pdfExtract } from './adapters/pdf-extract.ts';
import { readerExtract } from './adapters/reader-extract.ts';
import { tableExtract } from './adapters/table-extract.ts';
import { urlNormalize } from './adapters/url-normalize.ts';
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
  },
  {
    toolId: 'pdf_extract',
    action: 'extract',
    async execute(input) {
      const url = typeof input.url === 'string' ? input.url : undefined;
      const pdfContent = input.pdfContent instanceof Uint8Array ? input.pdfContent : undefined;
      if (!url && !pdfContent) {
        throw new Error('ERR_TOOL_INPUT: pdf_extract pdfContent or url is required');
      }

      const result = await pdfExtract({
        url,
        pdfContent,
        fetchImpl: typeof input.fetchImpl === 'function' ? input.fetchImpl as typeof fetch : undefined,
        pdfParser: input.pdfParser && typeof input.pdfParser === 'object'
          ? input.pdfParser as Parameters<typeof pdfExtract>[0]['pdfParser']
          : undefined
      });
      return result as unknown as Record<string, unknown>;
    }
  },
  {
    toolId: 'table_extract',
    action: 'extract',
    async execute(input) {
      const html = typeof input.html === 'string' ? input.html : '';
      if (html.trim().length === 0) {
        throw new Error('ERR_TOOL_INPUT: table_extract html is required');
      }
      return tableExtract({ html }) as unknown as Record<string, unknown>;
    }
  },
  {
    toolId: 'company_extract',
    action: 'extract',
    async execute(input) {
      return companyExtract({
        html: typeof input.html === 'string' ? input.html : undefined,
        text: typeof input.text === 'string' ? input.text : undefined,
        url: typeof input.url === 'string' ? input.url : undefined,
        extractor: input.extractor && typeof input.extractor === 'object'
          ? input.extractor as Parameters<typeof companyExtract>[0]['extractor']
          : undefined
      }) as unknown as Record<string, unknown>;
    }
  },
  {
    toolId: 'contact_extract',
    action: 'extract',
    async execute(input) {
      return contactExtract({
        html: typeof input.html === 'string' ? input.html : undefined,
        text: typeof input.text === 'string' ? input.text : undefined,
        url: typeof input.url === 'string' ? input.url : undefined,
        organization: typeof input.organization === 'string' ? input.organization : undefined,
        extractor: input.extractor && typeof input.extractor === 'object'
          ? input.extractor as Parameters<typeof contactExtract>[0]['extractor']
          : undefined
      }) as unknown as Record<string, unknown>;
    }
  },
  {
    toolId: 'commodity_data',
    action: 'extract',
    async execute(input) {
      const rows = Array.isArray(input.rows)
        ? input.rows.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        : [];
      return commodityData({ rows }) as unknown as Record<string, unknown>;
    }
  },
  {
    toolId: 'url_normalize',
    action: 'normalize',
    async execute(input) {
      return urlNormalize({
        url: typeof input.url === 'string' ? input.url : undefined,
        urls: Array.isArray(input.urls) ? input.urls.filter((entry): entry is string => typeof entry === 'string') : undefined
      }) as unknown as Record<string, unknown>;
    }
  },
  {
    toolId: 'domain_classify',
    action: 'classify',
    async execute(input) {
      const url = typeof input.url === 'string' ? input.url : '';
      if (url.length === 0) {
        throw new Error('ERR_TOOL_INPUT: domain_classify url is required');
      }

      return domainClassify({
        url,
        title: typeof input.title === 'string' ? input.title : undefined,
        content: typeof input.content === 'string' ? input.content : undefined
      }) as unknown as Record<string, unknown>;
    }
  },
  {
    toolId: 'email_extract',
    action: 'extract',
    async execute(input) {
      const html = typeof input.html === 'string' ? input.html : '';
      if (html.length === 0) {
        throw new Error('ERR_TOOL_INPUT: email_extract html is required');
      }

      return emailExtract({ html }) as unknown as Record<string, unknown>;
    }
  },
  {
    toolId: 'list_rank',
    action: 'rank',
    async execute(input) {
      const entities = Array.isArray(input.entities)
        ? input.entities.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        : [];
      return listRank({ entities }) as unknown as Record<string, unknown>;
    }
  },
  {
    toolId: 'browser_fetch',
    action: 'fetch',
    async execute(input) {
      const url = typeof input.url === 'string' ? input.url : '';
      if (url.length === 0) {
        throw new Error('ERR_TOOL_INPUT: browser_fetch url is required');
      }

      return browserFetch({
        url,
        timeoutMs: typeof input.timeoutMs === 'number' ? input.timeoutMs : undefined,
        renderer: input.renderer && typeof input.renderer === 'object'
          ? input.renderer as Parameters<typeof browserFetch>[0]['renderer']
          : undefined
      }) as unknown as Record<string, unknown>;
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
