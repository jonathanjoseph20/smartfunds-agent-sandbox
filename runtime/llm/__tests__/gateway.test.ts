import { describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../../../control-plane/finance/determinism.ts';
import { createLLMGateway } from '../gateway.ts';
import type { LLMProvider, ProviderInvokeRequest, ProviderInvokeResponse } from '../providers/provider.ts';
import type { LLMRequest } from '../types.ts';

class StubProvider implements LLMProvider {
  constructor(
    public readonly providerId: string,
    private readonly content: string,
    private readonly usage: ProviderInvokeResponse['usage'] = { inputTokens: 1, outputTokens: 2 }
  ) {}

  async invoke(_request: ProviderInvokeRequest): Promise<ProviderInvokeResponse> {
    return {
      model: `${this.providerId}-model`,
      content: this.content,
      usage: this.usage
    };
  }
}

function makeRequest(overrides: Partial<LLMRequest> = {}): LLMRequest {
  return {
    taskType: 'summarization',
    outputMode: 'text',
    promptEnvelope: {
      missionId: 'mission-1',
      runId: 'run-1',
      workflowNodeId: 'node-1',
      teamId: 'team-1',
      agentId: 'agent-1',
      taskType: 'summarization',
      inputs: { text: 'abc' },
      constraints: ['deterministic'],
      requestedArtifacts: ['report.csv'],
      outputInstructions: 'Summarize'
    },
    ...overrides
  };
}

describe('runtime llm gateway', () => {
  it('T-L1 routes by preference > routeHint > taskType > default', async () => {
    const gateway = createLLMGateway({
      policy: {
        default: 'ollama',
        summarization: 'groq',
        extract: 'ollama',
        analysis: 'google',
        comparison: 'openrouter',
        premium: 'openai',
        fastlane: 'anthropic'
      },
      models: {
        defaultModelByProvider: {
          ollama: 'o-model',
          groq: 'g-model',
          google: 'go-model',
          openrouter: 'or-model',
          openai: 'oa-model',
          anthropic: 'a-model'
        }
      },
      providers: {
        ollama: new StubProvider('ollama', 'ollama-out'),
        groq: new StubProvider('groq', 'groq-out'),
        google: new StubProvider('google', 'google-out'),
        openrouter: new StubProvider('openrouter', 'openrouter-out'),
        openai: new StubProvider('openai', 'openai-out'),
        anthropic: new StubProvider('anthropic', 'anthropic-out')
      },
      env: {
        GROQ_API_KEY: 'k',
        OPENROUTER_API_KEY: 'k',
        GOOGLE_API_KEY: 'k',
        OPENAI_API_KEY: 'k',
        ANTHROPIC_API_KEY: 'k'
      },
      checkProviderReachability: false
    });

    const preferred = await gateway.invoke(makeRequest({ providerPreference: 'openai' }));
    expect(preferred.provider).toBe('openai');

    const hinted = await gateway.invoke(makeRequest({ providerPreference: null, routeHint: 'fastlane' }));
    expect(hinted.provider).toBe('anthropic');

    const taskMapped = await gateway.invoke(makeRequest({ providerPreference: null, routeHint: undefined }));
    expect(taskMapped.provider).toBe('groq');

    const fallbackDefault = await gateway.invoke(makeRequest({ taskType: 'unknown-task', providerPreference: null }));
    expect(fallbackDefault.provider).toBe('ollama');
  });

  it('T-L2 fails clearly when provider is unavailable', async () => {
    const gateway = createLLMGateway({
      policy: { default: 'groq' },
      models: { defaultModelByProvider: { groq: 'g-model' } },
      providers: {
        groq: new StubProvider('groq', 'x')
      },
      env: {},
      checkProviderReachability: false
    });

    await expect(gateway.invoke(makeRequest({ taskType: 'unknown-task' }))).rejects.toThrow(
      'LLM_PROVIDER_UNAVAILABLE: provider=groq'
    );
  });

  it('T-L3 parses best-effort-json using extraction', async () => {
    const gateway = createLLMGateway({
      policy: { default: 'ollama' },
      models: { defaultModelByProvider: { ollama: 'o-model' } },
      providers: {
        ollama: new StubProvider('ollama', 'prefix text {"a":1,"b":"x"} suffix text')
      },
      checkProviderReachability: false
    });

    const response = await gateway.invoke(makeRequest({ outputMode: 'best-effort-json' }));
    expect(response.parsedJson).toEqual({ a: 1, b: 'x' });
  });

  it('T-L4 computes deterministic response hash from canonical response object', async () => {
    const gateway = createLLMGateway({
      policy: { default: 'ollama' },
      models: { defaultModelByProvider: { ollama: 'o-model' } },
      providers: {
        ollama: new StubProvider('ollama', 'plain text', { inputTokens: null, outputTokens: null })
      },
      checkProviderReachability: false
    });

    const response = await gateway.invoke(makeRequest({ outputMode: 'text' }));

    const expected = sha256(canonicalStringify({
      provider: 'ollama',
      model: 'ollama-model',
      outputMode: 'text',
      content: 'plain text',
      parsedJson: undefined,
      usage: { inputTokens: null, outputTokens: null }
    }));

    expect(response.responseHash).toBe(expected);
  });

  it('T-L5 enforces strict object json mode', async () => {
    const gateway = createLLMGateway({
      policy: { default: 'ollama' },
      models: { defaultModelByProvider: { ollama: 'o-model' } },
      providers: {
        ollama: new StubProvider('ollama', '"not-an-object"')
      },
      checkProviderReachability: false
    });

    await expect(gateway.invoke(makeRequest({ outputMode: 'json' }))).rejects.toThrow(
      'LLM_INVALID_JSON: strict json mode requires object JSON output'
    );
  });
});
