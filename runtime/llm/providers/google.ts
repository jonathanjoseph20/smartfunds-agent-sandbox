import type { LLMProvider, ProviderInvokeRequest, ProviderInvokeResponse } from './provider.ts';

function toContents(request: ProviderInvokeRequest): Array<{ role: 'user'; parts: Array<{ text: string }> }> {
  return [{ role: 'user', parts: [{ text: JSON.stringify(request.promptEnvelope) }] }];
}

export function createGoogleProvider(input: {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
} = {}): LLMProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  const env = input.env ?? process.env;

  return {
    providerId: 'google',
    async invoke(request: ProviderInvokeRequest): Promise<ProviderInvokeResponse> {
      const apiKey = env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('LLM_PROVIDER_UNAVAILABLE: provider=google missing=GOOGLE_API_KEY');
      }

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: request.promptEnvelope.outputInstructions }]
          },
          contents: toContents(request),
          generationConfig: request.maxTokens ? { maxOutputTokens: request.maxTokens } : undefined
        })
      });

      if (!response.ok) {
        throw new Error(`LLM_PROVIDER_ERROR: provider=google status=${response.status}`);
      }

      const payload = await response.json() as Record<string, unknown>;
      const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
      const first = candidates[0] as Record<string, unknown> | undefined;
      const contentObj = first && typeof first === 'object' ? first.content as Record<string, unknown> : undefined;
      const parts = contentObj && Array.isArray(contentObj.parts) ? contentObj.parts : [];
      const content = parts
        .map((part) => (part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string')
          ? (part as Record<string, unknown>).text as string
          : '')
        .join('\n')
        .trim();

      const usage = payload.usageMetadata as Record<string, unknown> | undefined;
      return {
        model: request.model,
        content,
        usage: {
          inputTokens: typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : null,
          outputTokens: typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : null
        }
      };
    }
  };
}
