import type { LLMProvider, ProviderInvokeRequest, ProviderInvokeResponse } from './provider.ts';

function toMessages(request: ProviderInvokeRequest): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: request.promptEnvelope.outputInstructions },
    { role: 'user', content: JSON.stringify(request.promptEnvelope) }
  ];
}

export function createOpenRouterProvider(input: {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
} = {}): LLMProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  const env = input.env ?? process.env;

  return {
    providerId: 'openrouter',
    async invoke(request: ProviderInvokeRequest): Promise<ProviderInvokeResponse> {
      const apiKey = env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('LLM_PROVIDER_UNAVAILABLE: provider=openrouter missing=OPENROUTER_API_KEY');
      }

      const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          messages: toMessages(request),
          max_tokens: request.maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`LLM_PROVIDER_ERROR: provider=openrouter status=${response.status}`);
      }

      const payload = await response.json() as Record<string, unknown>;
      const choices = Array.isArray(payload.choices) ? payload.choices : [];
      const first = choices[0] as Record<string, unknown> | undefined;
      const message = first && typeof first === 'object' ? first.message as Record<string, unknown> : undefined;
      const content = message && typeof message.content === 'string' ? message.content : '';
      const usage = payload.usage as Record<string, unknown> | undefined;

      return {
        model: request.model,
        content,
        usage: {
          inputTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
          outputTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null
        }
      };
    }
  };
}
