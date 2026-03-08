import type { LLMProvider, ProviderInvokeRequest, ProviderInvokeResponse } from './provider.ts';

export function createAnthropicProvider(input: {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
} = {}): LLMProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  const env = input.env ?? process.env;

  return {
    providerId: 'anthropic',
    async invoke(request: ProviderInvokeRequest): Promise<ProviderInvokeResponse> {
      const apiKey = env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('LLM_PROVIDER_UNAVAILABLE: provider=anthropic missing=ANTHROPIC_API_KEY');
      }

      const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          system: request.promptEnvelope.outputInstructions,
          max_tokens: request.maxTokens ?? 1024,
          messages: [
            {
              role: 'user',
              content: JSON.stringify(request.promptEnvelope)
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`LLM_PROVIDER_ERROR: provider=anthropic status=${response.status}`);
      }

      const payload = await response.json() as Record<string, unknown>;
      const contentBlocks = Array.isArray(payload.content) ? payload.content : [];
      const content = contentBlocks
        .map((entry) => (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).text === 'string')
          ? (entry as Record<string, unknown>).text as string
          : '')
        .join('\n')
        .trim();

      const usage = payload.usage as Record<string, unknown> | undefined;
      return {
        model: request.model,
        content,
        usage: {
          inputTokens: typeof usage?.input_tokens === 'number' ? usage.input_tokens : null,
          outputTokens: typeof usage?.output_tokens === 'number' ? usage.output_tokens : null
        }
      };
    }
  };
}
