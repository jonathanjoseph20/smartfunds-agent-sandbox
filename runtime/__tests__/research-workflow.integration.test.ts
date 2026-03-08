import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createLLMGateway } from '../llm/gateway.ts';
import type { LLMProvider, ProviderInvokeRequest, ProviderInvokeResponse } from '../llm/providers/provider.ts';
import { ArtifactWriter } from '../output/artifact-writer.ts';
import { SourceRegistry } from '../output/source-registry.ts';
import { executeRuntimeTask } from '../runtime-task-executor.ts';

const tmpRoot = path.join('runtime', '__tests__', 'tmp-sprint-78');

class SummaryProvider implements LLMProvider {
  readonly providerId = 'ollama';

  async invoke(_request: ProviderInvokeRequest): Promise<ProviderInvokeResponse> {
    return {
      model: 'llama3.1:8b',
      content: '{"summary":"Deterministic summary","confidence":"high"}',
      usage: { inputTokens: 10, outputTokens: 5 }
    };
  }
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('sprint 78 integration simulation', () => {
  it('T-I1 executes search->fetch->extract->summarize->write-csv deterministically', async () => {
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string | URL) => {
      const textUrl = String(url);
      fetchCalls.push(textUrl);

      if (textUrl.startsWith('https://duckduckgo.com/html/')) {
        return {
          ok: true,
          status: 200,
          url: textUrl,
          headers: { get: () => 'text/html' },
          text: async () => '<html><body><div class="result"><a href="https://example.com/source">Example Source</a></div></body></html>'
        } as Response;
      }

      if (textUrl === 'https://example.com/source') {
        return {
          ok: true,
          status: 200,
          url: textUrl,
          headers: { get: () => 'text/html; charset=utf-8' },
          text: async () => '<html><head><title>Example</title></head><body><nav>menu</nav><main><p>Alpha data point</p></main></body></html>'
        } as Response;
      }

      throw new Error(`unexpected fetch: ${textUrl}`);
    }) as typeof fetch;

    try {
      const artifactWriter = new ArtifactWriter(tmpRoot, [{ artifactId: 'research_csv', format: 'csv' }]);
      const gateway = createLLMGateway({
        policy: { default: 'ollama' },
        models: { defaultModelByProvider: { ollama: 'llama3.1:8b' } },
        providers: { ollama: new SummaryProvider() },
        checkProviderReachability: false
      });

      const missionId = 'mission-s78';
      const runId = 'run-s78';
      const sourceRegistry = new SourceRegistry();

      const search = await executeRuntimeTask({
        taskType: 'tool.web_search',
        payload: { query: 'example source' },
        missionId,
        runId,
        workflowNodeId: 'search',
        llmGateway: gateway,
        artifactWriter
      });

      const resultRows = search.results as Array<{ url: string; domain: string; rank: number; title: string }>;
      expect(resultRows.length).toBe(1);
      sourceRegistry.add({ url: resultRows[0].url, firstSeenStep: 'search' });

      const fetched = await executeRuntimeTask({
        taskType: 'tool.page_fetch',
        payload: { url: resultRows[0].url },
        missionId,
        runId,
        workflowNodeId: 'fetch',
        llmGateway: gateway,
        artifactWriter
      });

      const extracted = await executeRuntimeTask({
        taskType: 'tool.reader_extract',
        payload: { html: fetched.html },
        missionId,
        runId,
        workflowNodeId: 'extract',
        llmGateway: gateway,
        artifactWriter
      });

      const summarized = await executeRuntimeTask({
        taskType: 'llm.generate',
        payload: {
          taskType: 'summarization',
          outputMode: 'json',
          inputs: {
            title: extracted.title,
            body: extracted.body
          },
          constraints: ['deterministic'],
          requestedArtifacts: ['research_csv'],
          outputInstructions: 'Return summary JSON object'
        },
        missionId,
        runId,
        workflowNodeId: 'summarize',
        llmGateway: gateway,
        artifactWriter,
        missionContextMemory: {
          teamId: 'team-r',
          agentId: 'agent-r'
        }
      });

      expect(summarized.parsedJson).toEqual({ summary: 'Deterministic summary', confidence: 'high' });

      const write = await executeRuntimeTask({
        taskType: 'output.write_csv',
        payload: {
          artifactId: 'research_csv',
          rows: [{
            domain: resultRows[0].domain,
            title: extracted.title,
            summary: (summarized.parsedJson as Record<string, unknown>).summary
          }]
        },
        missionId,
        runId,
        workflowNodeId: 'write',
        llmGateway: gateway,
        artifactWriter
      });

      const csvPath = write.filePath as string;
      const csv = fs.readFileSync(csvPath, 'utf8');

      expect(fs.existsSync(csvPath)).toBe(true);
      expect(csv).toBe([
        'domain,summary,title',
        'example.com,Deterministic summary,Example',
        ''
      ].join('\n'));

      expect(sourceRegistry.list()).toEqual([
        {
          url: 'https://example.com/source',
          domain: 'example.com',
          firstSeenStep: 'search'
        }
      ]);

      expect(fetchCalls).toEqual([
        'https://duckduckgo.com/html/?q=example+source',
        'https://example.com/source'
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
