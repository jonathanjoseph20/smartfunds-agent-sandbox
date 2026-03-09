import { createLLMGateway, type LLMGateway } from '../../llm/gateway.ts';
import type { LLMRequest } from '../../llm/types.ts';
import type { LLMInvokeInput, LLMInvokeResponse } from './llm-types.ts';

type SupportedProvider = 'openai' | 'openrouter' | 'deepseek';

const DEFAULT_PROVIDER: SupportedProvider = 'openai';
const DEFAULT_MODEL_BY_PROVIDER: Record<SupportedProvider, string> = {
  openai: 'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',
  deepseek: 'deepseek/deepseek-chat'
};

function normalizeProvider(value: string | undefined): SupportedProvider {
  if (value === 'openai' || value === 'openrouter' || value === 'deepseek') {
    return value;
  }
  return DEFAULT_PROVIDER;
}

function toGatewayProvider(provider: SupportedProvider): 'openai' | 'openrouter' {
  if (provider === 'deepseek') {
    return 'openrouter';
  }
  return provider;
}

function toUsage(input: { inputTokens?: number | null; outputTokens?: number | null } | undefined): LLMInvokeResponse['usage'] {
  const promptTokens = typeof input?.inputTokens === 'number' && Number.isFinite(input.inputTokens)
    ? Math.max(0, Math.trunc(input.inputTokens))
    : 0;
  const completionTokens = typeof input?.outputTokens === 'number' && Number.isFinite(input.outputTokens)
    ? Math.max(0, Math.trunc(input.outputTokens))
    : 0;

  return {
    promptTokens,
    completionTokens
  };
}

function toRequest(input: LLMInvokeInput): LLMRequest {
  const systemPrompt = typeof input.systemPrompt === 'string' && input.systemPrompt.trim().length > 0
    ? input.systemPrompt.trim()
    : 'You are a deterministic research assistant. Return concise, factual output.';

  const prompt = input.prompt.trim();

  return {
    taskType: 'intelligence-adapter',
    outputMode: 'text',
    maxTokens: typeof input.maxTokens === 'number' ? input.maxTokens : undefined,
    promptEnvelope: {
      missionId: 'runtime-intelligence',
      runId: 'runtime-intelligence',
      workflowNodeId: 'llm-router',
      teamId: 'runtime',
      agentId: 'intelligence-adapter',
      taskType: 'intelligence-adapter',
      inputs: {
        prompt,
        ...(typeof input.temperature === 'number' ? { temperature: input.temperature } : {})
      },
      constraints: ['deterministic-shape'],
      requestedArtifacts: [],
      outputInstructions: systemPrompt
    }
  };
}

export async function routeLLMRequest(
  input: LLMInvokeInput,
  options: {
    env?: NodeJS.ProcessEnv;
    createGateway?: (input: {
      provider: 'openai' | 'openrouter';
      model: string;
      env: NodeJS.ProcessEnv;
    }) => LLMGateway;
  } = {}
): Promise<LLMInvokeResponse> {
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (prompt.length === 0) {
    throw new Error('ERR_LLM_INPUT: prompt is required');
  }

  const env = options.env ?? process.env;
  const configuredProvider = normalizeProvider(env.LLM_PROVIDER);
  const provider = toGatewayProvider(configuredProvider);
  const model = (typeof input.model === 'string' && input.model.trim().length > 0)
    ? input.model.trim()
    : (env.LLM_MODEL?.trim() || DEFAULT_MODEL_BY_PROVIDER[configuredProvider]);

  const createGateway = options.createGateway ?? ((gatewayInput: {
    provider: 'openai' | 'openrouter';
    model: string;
    env: NodeJS.ProcessEnv;
  }) => createLLMGateway({
    policy: { default: gatewayInput.provider },
    models: { defaultModelByProvider: { [gatewayInput.provider]: gatewayInput.model } },
    env: gatewayInput.env,
    checkProviderReachability: false
  }));

  const gateway = createGateway({ provider, model, env });
  const response = await gateway.invoke(toRequest(input));

  return {
    model: response.model,
    content: response.content,
    usage: toUsage(response.usage)
  };
}
