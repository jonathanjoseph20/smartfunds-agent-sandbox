import { describe, expect, it, vi } from 'vitest';

import type { LLMGateway } from '../../llm/gateway.ts';
import { invokeLLM } from './llm-adapter.ts';
import * as router from './llm-router.ts';
import { routeLLMRequest } from './llm-router.ts';

describe('llm adapter', () => {
  it('T-LLM1 returns deterministic normalized response shape', async () => {
    const route = vi.spyOn(router, 'routeLLMRequest').mockResolvedValueOnce({
      model: 'gpt-4o-mini',
      content: 'Answer',
      usage: { promptTokens: 10, completionTokens: 20 }
    });

    const response = await invokeLLM({ prompt: 'Hello' });

    expect(response).toEqual({
      model: 'gpt-4o-mini',
      content: 'Answer',
      usage: {
        promptTokens: 10,
        completionTokens: 20
      }
    });
    route.mockRestore();
  });

  it('T-LLM2 routes provider from env and normalizes usage', async () => {
    const response = await routeLLMRequest(
      { prompt: 'hello world' },
      {
        env: {
          LLM_PROVIDER: 'deepseek',
          LLM_MODEL: 'deepseek/deepseek-chat'
        },
        createGateway(input): LLMGateway {
          expect(input.provider).toBe('openrouter');
          expect(input.model).toBe('deepseek/deepseek-chat');
          return {
            async invoke() {
              return {
                provider: 'openrouter',
                model: input.model,
                outputMode: 'text',
                content: 'ok',
                usage: {
                  inputTokens: null,
                  outputTokens: 3
                },
                responseHash: 'hash'
              };
            }
          };
        }
      }
    );

    expect(response).toEqual({
      model: 'deepseek/deepseek-chat',
      content: 'ok',
      usage: {
        promptTokens: 0,
        completionTokens: 3
      }
    });
  });

  it('T-LLM3 validates empty prompt', async () => {
    await expect(routeLLMRequest({ prompt: '   ' })).rejects.toThrow('ERR_LLM_INPUT: prompt is required');
  });
});
