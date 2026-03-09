import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLLMGateway } from '../llm/gateway.ts';
import { ArtifactWriter } from '../output/artifact-writer.ts';

vi.mock('../adapters/llm/llm-adapter.ts', () => ({
  invokeLLM: vi.fn()
}));

import { invokeLLM } from '../adapters/llm/llm-adapter.ts';
import { executeRuntimeTask } from '../runtime-task-executor.ts';

const tmpRoot = path.join('runtime', '__tests__', 'tmp-sprint-83');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('sprint 83 research web intelligence integration', () => {
  it('T-I83-1 writes search-results.json research-pages.json dataset.csv and report.md via artifact writer', async () => {
    const mockedInvokeLLM = vi.mocked(invokeLLM);
    mockedInvokeLLM
      .mockResolvedValueOnce({
        model: 'gpt-4o-mini',
        content: '{"assetType":"equity","company":"Alpha Capital","location":"Texas","stage":"growth"}',
        usage: { promptTokens: 11, completionTokens: 7 }
      })
      .mockResolvedValueOnce({
        model: 'gpt-4o-mini',
        content: '# Research Report\n\nAlpha Capital is in growth stage in Texas.',
        usage: { promptTokens: 8, completionTokens: 12 }
      });

    const mockFetch = (async (url: string | URL) => {
      const textUrl = String(url);
      if (textUrl.startsWith('https://duckduckgo.com/html/')) {
        return {
          text: async () => '<html><body><div class="result"><a class="result__a" href="https://example.com/alpha">Alpha Capital</a><div class="result__snippet">Issuer profile</div></div></body></html>'
        } as Response;
      }

      if (textUrl === 'https://example.com/alpha') {
        return {
          ok: true,
          status: 200,
          text: async () => '<html><head><title>Alpha Capital</title></head><body><main><article><p>Alpha Capital is based in Texas and in growth stage.</p></article></main></body></html>'
        } as Response;
      }

      throw new Error(`unexpected fetch: ${textUrl}`);
    }) as typeof fetch;

    const artifactWriter = new ArtifactWriter(tmpRoot, [
      { artifactId: 'search-results', format: 'artifact' },
      { artifactId: 'research-pages', format: 'artifact' },
      { artifactId: 'dataset', format: 'csv' },
      { artifactId: 'report', format: 'markdown' }
    ]);

    const llmGateway = createLLMGateway({
      policy: { default: 'ollama' },
      models: { defaultModelByProvider: { ollama: 'llama3.1:8b' } },
      providers: {
        ollama: {
          providerId: 'ollama',
          async invoke() {
            return {
              model: 'llama3.1:8b',
              content: 'unused'
            };
          }
        }
      },
      checkProviderReachability: false
    });

    const missionId = 'research-web-intelligence';
    const runId = 'run-0001';

    const search = await executeRuntimeTask({
      taskType: 'adapter.search_web',
      payload: { query: 'alpha capital', maxResults: 1, fetchImpl: mockFetch },
      missionId,
      runId,
      workflowNodeId: 'search-web',
      llmGateway,
      artifactWriter
    });

    const results = search.results as Array<Record<string, unknown>>;
    const page = await executeRuntimeTask({
      taskType: 'adapter.fetch_page',
      payload: { url: String(results[0].url), fetchImpl: mockFetch },
      missionId,
      runId,
      workflowNodeId: 'fetch-pages',
      llmGateway,
      artifactWriter
    });

    const extracted = await executeRuntimeTask({
      taskType: 'adapter.extract_structured_data',
      payload: {
        text: String(page.text),
        schema: {
          company: 'string',
          assetType: 'string',
          location: 'string',
          stage: 'string'
        }
      },
      missionId,
      runId,
      workflowNodeId: 'extract-content',
      llmGateway,
      artifactWriter
    });

    const report = await executeRuntimeTask({
      taskType: 'adapter.llm_invoke',
      payload: {
        prompt: 'Summarize extracted data as markdown.'
      },
      missionId,
      runId,
      workflowNodeId: 'analyze-with-llm',
      llmGateway,
      artifactWriter
    });

    await executeRuntimeTask({
      taskType: 'output.write_artifact',
      payload: {
        artifactId: 'search-results',
        payload: results
      },
      missionId,
      runId,
      workflowNodeId: 'write-search-results',
      llmGateway,
      artifactWriter
    });

    await executeRuntimeTask({
      taskType: 'output.write_artifact',
      payload: {
        artifactId: 'research-pages',
        payload: [page]
      },
      missionId,
      runId,
      workflowNodeId: 'write-research-pages',
      llmGateway,
      artifactWriter
    });

    await executeRuntimeTask({
      taskType: 'output.write_csv',
      payload: {
        artifactId: 'dataset',
        rows: [extracted.data]
      },
      missionId,
      runId,
      workflowNodeId: 'write-dataset',
      llmGateway,
      artifactWriter
    });

    await executeRuntimeTask({
      taskType: 'output.write_markdown',
      payload: {
        artifactId: 'report',
        content: String(report.content)
      },
      missionId,
      runId,
      workflowNodeId: 'write-report',
      llmGateway,
      artifactWriter
    });

    const base = path.join(tmpRoot, missionId, runId);
    expect(fs.existsSync(path.join(base, 'search-results.json'))).toBe(true);
    expect(fs.existsSync(path.join(base, 'research-pages.json'))).toBe(true);
    expect(fs.existsSync(path.join(base, 'dataset.csv'))).toBe(true);
    expect(fs.existsSync(path.join(base, 'report.md'))).toBe(true);

    expect(fs.readFileSync(path.join(base, 'dataset.csv'), 'utf8')).toContain('assetType,company,location,stage');
    expect(fs.readFileSync(path.join(base, 'report.md'), 'utf8')).toContain('# Research Report');
  });
});
