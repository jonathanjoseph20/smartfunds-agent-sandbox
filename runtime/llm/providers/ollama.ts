import type { LLMProvider, ProviderInvokeRequest, ProviderInvokeResponse } from './provider.ts';

function toPrompt(request: ProviderInvokeRequest): string {
  return [
    `taskType=${request.promptEnvelope.taskType}`,
    `constraints=${request.promptEnvelope.constraints.join(' | ')}`,
    `requestedArtifacts=${request.promptEnvelope.requestedArtifacts.join(',')}`,
    `outputInstructions=${request.promptEnvelope.outputInstructions}`,
    `inputs=${JSON.stringify(request.promptEnvelope.inputs)}`
  ].join('\n');
}

export function createOllamaProvider(input: {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
} = {}): LLMProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  const env = input.env ?? process.env;

  return {
    providerId: 'ollama',
    async invoke(request: ProviderInvokeRequest): Promise<ProviderInvokeResponse> {
      const baseUrl = env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          prompt: toPrompt(request),
          stream: false,
          options: request.maxTokens ? { num_predict: request.maxTokens } : undefined
        })
      });

      if (!response.ok) {
        throw new Error(`LLM_PROVIDER_ERROR: provider=ollama status=${response.status}`);
      }

      const payload = await response.json() as Record<string, unknown>;
      const content = typeof payload.response === 'string' ? payload.response : '';

      return {
        model: request.model,
        content,
        usage: {
          inputTokens: typeof payload.prompt_eval_count === 'number' ? payload.prompt_eval_count : null,
          outputTokens: typeof payload.eval_count === 'number' ? payload.eval_count : null
        }
      };
    }
  };
}
