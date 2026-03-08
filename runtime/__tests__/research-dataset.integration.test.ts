import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createLLMGateway } from '../llm/gateway.ts';
import type { LLMProvider, ProviderInvokeRequest, ProviderInvokeResponse } from '../llm/providers/provider.ts';
import { ArtifactWriter } from '../output/artifact-writer.ts';
import { executeRuntimeTask } from '../runtime-task-executor.ts';

const tmpRoot = path.join('runtime', '__tests__', 'tmp-sprint-79');

class StubProvider implements LLMProvider {
  readonly providerId = 'ollama';

  async invoke(_request: ProviderInvokeRequest): Promise<ProviderInvokeResponse> {
    return {
      model: 'llama3.1:8b',
      content: '{"ok":true}'
    };
  }
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('sprint 79 research dataset integration', () => {
  it('T-I79-1 executes deterministic structured dataset pipeline', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL) => {
      const textUrl = String(url);

      if (textUrl.startsWith('https://duckduckgo.com/html/')) {
        return {
          ok: true,
          status: 200,
          url: textUrl,
          headers: { get: () => 'text/html' },
          text: async () => [
            '<html><body>',
            '<div class="result"><a href="https://alpha.example.com">Alpha Mining</a></div>',
            '<div class="result"><a href="https://market.example.com/copper">Copper Market</a></div>',
            '</body></html>'
          ].join('')
        } as Response;
      }

      if (textUrl === 'https://alpha.example.com') {
        return {
          ok: true,
          status: 200,
          url: textUrl,
          headers: { get: () => 'text/html; charset=utf-8' },
          text: async () => '<html><head><title>Alpha Mining</title></head><body><p>Alpha Mining explores lithium in Nevada.</p><a href="mailto:ceo@alpha.example.com">Email</a></body></html>'
        } as Response;
      }

      if (textUrl === 'https://market.example.com/copper') {
        return {
          ok: true,
          status: 200,
          url: textUrl,
          headers: { get: () => 'text/html; charset=utf-8' },
          text: async () => '<html><head><title>Copper Market</title></head><body><table><tr><th>Commodity</th><th>Price</th><th>Daily Volume</th><th>Market Liquidity</th><th>Volatility</th><th>Exchange</th></tr><tr><td>Copper</td><td>$100</td><td>400</td><td>120</td><td>20</td><td>CME</td></tr></table></body></html>'
        } as Response;
      }

      throw new Error(`unexpected fetch: ${textUrl}`);
    }) as typeof fetch;

    try {
      const artifactWriter = new ArtifactWriter(tmpRoot, [
        { artifactId: 'outreach_targets', format: 'xlsx' },
        { artifactId: 'crypto_sources', format: 'csv' },
        { artifactId: 'collateral_candidates', format: 'csv' }
      ]);

      const llmGateway = createLLMGateway({
        policy: { default: 'ollama' },
        models: { defaultModelByProvider: { ollama: 'llama3.1:8b' } },
        providers: { ollama: new StubProvider() },
        checkProviderReachability: false
      });

      const missionId = 'mission-s79';
      const runId = 'run-s79';

      const search = await executeRuntimeTask({
        taskType: 'tool.web_search',
        payload: { query: 'mining companies and copper market data', limit: 2 },
        missionId,
        runId,
        workflowNodeId: 'search',
        llmGateway,
        artifactWriter
      });

      const sources = search.results as Array<{ url: string; title: string; domain: string }>;
      const fetchedCompany = await executeRuntimeTask({
        taskType: 'tool.page_fetch',
        payload: { url: sources[0].url },
        missionId,
        runId,
        workflowNodeId: 'fetch-company',
        llmGateway,
        artifactWriter
      });

      const extractedCompany = await executeRuntimeTask({
        taskType: 'tool.reader_extract',
        payload: { html: fetchedCompany.html },
        missionId,
        runId,
        workflowNodeId: 'extract-company',
        llmGateway,
        artifactWriter
      });

      const company = await executeRuntimeTask({
        taskType: 'tool.company_extract',
        payload: {
          url: sources[0].url,
          html: fetchedCompany.html,
          text: extractedCompany.body
        },
        missionId,
        runId,
        workflowNodeId: 'company',
        llmGateway,
        artifactWriter
      });

      const contacts = await executeRuntimeTask({
        taskType: 'tool.contact_extract',
        payload: {
          url: sources[0].url,
          organization: 'Alpha Mining',
          html: fetchedCompany.html,
          text: extractedCompany.body,
          extractor: {
            async extract() {
              return [{
                name: 'Alice Mason',
                role: 'CEO',
                email: 'ceo@alpha.example.com',
                linkedin: 'https://www.linkedin.com/in/alice-mason/',
                organization: 'Alpha Mining'
              }];
            }
          }
        },
        missionId,
        runId,
        workflowNodeId: 'contact',
        llmGateway,
        artifactWriter
      });

      const fetchedCommodity = await executeRuntimeTask({
        taskType: 'tool.page_fetch',
        payload: { url: sources[1].url },
        missionId,
        runId,
        workflowNodeId: 'fetch-commodity',
        llmGateway,
        artifactWriter
      });

      const table = await executeRuntimeTask({
        taskType: 'tool.table_extract',
        payload: { html: fetchedCommodity.html },
        missionId,
        runId,
        workflowNodeId: 'table',
        llmGateway,
        artifactWriter
      });

      const commodity = await executeRuntimeTask({
        taskType: 'tool.commodity_data',
        payload: {
          rows: [{
            commodity: (((table.tables as Array<Record<string, unknown>>)[0].rows as Array<Record<string, string>>)[0]).commodity,
            price: (((table.tables as Array<Record<string, unknown>>)[0].rows as Array<Record<string, string>>)[0]).price,
            daily_volume: (((table.tables as Array<Record<string, unknown>>)[0].rows as Array<Record<string, string>>)[0]).daily_volume,
            market_liquidity: (((table.tables as Array<Record<string, unknown>>)[0].rows as Array<Record<string, string>>)[0]).market_liquidity,
            volatility: (((table.tables as Array<Record<string, unknown>>)[0].rows as Array<Record<string, string>>)[0]).volatility,
            exchange: (((table.tables as Array<Record<string, unknown>>)[0].rows as Array<Record<string, string>>)[0]).exchange,
            source: sources[1].url
          }]
        },
        missionId,
        runId,
        workflowNodeId: 'commodity',
        llmGateway,
        artifactWriter
      });

      const normalizedSources = await Promise.all(sources.map(async (source) => {
        const normalized = await executeRuntimeTask({
          taskType: 'tool.url_normalize',
          payload: { url: source.url },
          missionId,
          runId,
          workflowNodeId: `normalize-${source.domain}`,
          llmGateway,
          artifactWriter
        });

        const classified = await executeRuntimeTask({
          taskType: 'tool.domain_classify',
          payload: { url: source.url, title: source.title },
          missionId,
          runId,
          workflowNodeId: `classify-${source.domain}`,
          llmGateway,
          artifactWriter
        });

        return {
          source: source.title,
          category: 'market',
          credibility: classified.domainType === 'company' ? 75 : 65,
          coverage: source.title.toLowerCase().includes('market') ? 80 : 60,
          domain_type: classified.domainType,
          domain: classified.domain,
          normalized_url: normalized.normalizedUrl
        };
      }));

      const ranked = await executeRuntimeTask({
        taskType: 'tool.list_rank',
        payload: { entities: normalizedSources },
        missionId,
        runId,
        workflowNodeId: 'rank',
        llmGateway,
        artifactWriter
      });

      const outreachWrite = await executeRuntimeTask({
        taskType: 'output.write_xlsx',
        payload: {
          artifactId: 'outreach_targets',
          sheets: [
            {
              name: 'companies',
              order: 1,
              rows: (company.companies as Array<Record<string, unknown>>).map((entry) => ({
                organization: entry.organization,
                minerals: Array.isArray(entry.minerals) ? (entry.minerals as string[]).join(', ') : '',
                location: entry.location,
                project_stage: entry.project_stage,
                website: entry.website,
                description: entry.description,
                source: entry.source
              }))
            },
            {
              name: 'contacts',
              order: 2,
              rows: (contacts.contacts as Array<Record<string, unknown>>).map((entry) => ({
                organization: entry.organization,
                principal: entry.name,
                email: entry.email,
                role: entry.role,
                linkedin: entry.linkedin,
                source: entry.source
              }))
            },
            {
              name: 'sources',
              order: 3,
              rows: normalizedSources.map((entry) => ({
                source: entry.source,
                domain: entry.domain,
                domain_type: entry.domain_type,
                normalized_url: entry.normalized_url
              }))
            }
          ]
        },
        missionId,
        runId,
        workflowNodeId: 'write-outreach',
        llmGateway,
        artifactWriter
      });

      const cryptoWrite = await executeRuntimeTask({
        taskType: 'output.write_csv',
        payload: {
          artifactId: 'crypto_sources',
          rows: (ranked.ranked as Array<Record<string, unknown>>).map((entry) => ({
            source: entry.source,
            category: entry.category,
            credibility: entry.credibility,
            coverage: entry.coverage,
            domain_type: entry.domain_type
          }))
        },
        missionId,
        runId,
        workflowNodeId: 'write-crypto',
        llmGateway,
        artifactWriter
      });

      const collateralWrite = await executeRuntimeTask({
        taskType: 'output.write_csv',
        payload: {
          artifactId: 'collateral_candidates',
          rows: commodity.rows
        },
        missionId,
        runId,
        workflowNodeId: 'write-collateral',
        llmGateway,
        artifactWriter
      });

      const outreachPath = outreachWrite.filePath as string;
      const cryptoPath = cryptoWrite.filePath as string;
      const collateralPath = collateralWrite.filePath as string;

      const outreachBytes = fs.readFileSync(outreachPath);
      const outreachText = outreachBytes.toString('utf8');
      const cryptoCsv = fs.readFileSync(cryptoPath, 'utf8');
      const collateralCsv = fs.readFileSync(collateralPath, 'utf8');

      expect(fs.existsSync(outreachPath)).toBe(true);
      expect(fs.existsSync(cryptoPath)).toBe(true);
      expect(fs.existsSync(collateralPath)).toBe(true);

      expect(outreachText).toContain('sheet name="companies"');
      expect(outreachText).toContain('sheet name="contacts"');
      expect(outreachText).toContain('sheet name="sources"');

      expect(cryptoCsv).toBe([
        'category,coverage,credibility,domain_type,source',
        'market,60,75,company,Alpha Mining',
        'market,80,75,company,Copper Market',
        ''
      ].join('\n'));

      expect(collateralCsv).toBe([
        'collateral_score,commodity,daily_volume,exchange,market_liquidity,price,source,volatility',
        '176,Copper,400,CME,120,100,https://market.example.com/copper,20',
        ''
      ].join('\n'));

      const outreachWriteSecond = await executeRuntimeTask({
        taskType: 'output.write_xlsx',
        payload: {
          artifactId: 'outreach_targets',
          sheets: [
            { name: 'sources', order: 3, rows: [{ source: 's', domain: 'd', domain_type: 'company', normalized_url: 'https://d/' }] },
            { name: 'contacts', order: 2, rows: [{ organization: 'o', principal: 'p', email: 'e', role: 'r', linkedin: '', source: 's' }] },
            { name: 'companies', order: 1, rows: [{ organization: 'o', minerals: '', location: '', project_stage: '', website: '', description: '', source: '' }] }
          ]
        },
        missionId,
        runId,
        workflowNodeId: 'write-outreach-second',
        llmGateway,
        artifactWriter
      });

      expect(fs.existsSync(outreachWriteSecond.filePath as string)).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
