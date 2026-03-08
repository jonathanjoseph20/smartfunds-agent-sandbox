import { canonicalStringify, sha256 } from '../../control-plane/finance/determinism.ts';
import { assertProviderAvailable } from './provider-status.ts';
import { loadProviderModels, loadProviderPolicy, resolveModelForProvider, resolveProviderForRequest, type ProviderModels, type ProviderPolicy } from './policy.ts';
import { createAnthropicProvider } from './providers/anthropic.ts';
import { createGoogleProvider } from './providers/google.ts';
import { createGroqProvider } from './providers/groq.ts';
import { createOllamaProvider } from './providers/ollama.ts';
import { createOpenAIProvider } from './providers/openai.ts';
import { createOpenRouterProvider } from './providers/openrouter.ts';
import type { LLMProvider } from './providers/provider.ts';
import type { LLMRequest, LLMResponse } from './types.ts';

type ParsedMode = Record<string, unknown> | null;

function parseStrictObjectJson(content: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('LLM_INVALID_JSON: strict json mode parse failed');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('LLM_INVALID_JSON: strict json mode requires object JSON output');
  }

  return parsed as Record<string, unknown>;
}

function extractJsonObjectCandidate(content: string): string | null {
  const start = content.indexOf('{');
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let i = start; i < content.length; i += 1) {
    const ch = content[i];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (ch === '\\') {
        escaping = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return content.slice(start, i + 1);
      }
    }
  }

  return null;
}

function tryParseBestEffortJson(content: string): ParsedMode {
  const candidate = extractJsonObjectCandidate(content);
  if (!candidate) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeOutput(input: {
  outputMode: LLMRequest['outputMode'];
  content: string;
}): { content: string; parsedJson?: Record<string, unknown> | null } {
  const content = input.content;

  if (input.outputMode === 'text') {
    return { content };
  }

  if (input.outputMode === 'json') {
    return {
      content,
      parsedJson: parseStrictObjectJson(content)
    };
  }

  return {
    content,
    parsedJson: tryParseBestEffortJson(content)
  };
}

function defaultProviders(): Record<string, LLMProvider> {
  return {
    ollama: createOllamaProvider(),
    groq: createGroqProvider(),
    openrouter: createOpenRouterProvider(),
    google: createGoogleProvider(),
    openai: createOpenAIProvider(),
    anthropic: createAnthropicProvider()
  };
}

export interface LLMGateway {
  invoke(request: LLMRequest): Promise<LLMResponse>;
}

export function createLLMGateway(input: {
  policy?: ProviderPolicy;
  models?: ProviderModels;
  providers?: Record<string, LLMProvider>;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  checkProviderReachability?: boolean;
  onLog?: (event: Record<string, unknown>) => void;
} = {}): LLMGateway {
  const policy = input.policy ?? loadProviderPolicy();
  const models = input.models ?? loadProviderModels();
  const providers = input.providers ?? defaultProviders();

  return {
    async invoke(request: LLMRequest): Promise<LLMResponse> {
      const providerId = resolveProviderForRequest(request, policy);
      const provider = providers[providerId];
      if (!provider) {
        throw new Error(`LLM_PROVIDER_UNAVAILABLE: provider=${providerId}`);
      }

      await assertProviderAvailable({
        provider,
        env: input.env,
        fetchImpl: input.fetchImpl,
        checkReachability: input.checkProviderReachability
      });

      const model = resolveModelForProvider(providerId, models);
      const raw = await provider.invoke({
        model,
        outputMode: request.outputMode,
        promptEnvelope: request.promptEnvelope,
        maxTokens: request.maxTokens
      });

      const normalized = normalizeOutput({
        outputMode: request.outputMode,
        content: raw.content
      });

      const responseWithoutHash = {
        provider: providerId,
        model: raw.model,
        outputMode: request.outputMode,
        content: normalized.content,
        parsedJson: normalized.parsedJson,
        usage: raw.usage
      };

      const responseHash = sha256(canonicalStringify(responseWithoutHash));
      const response: LLMResponse = {
        ...responseWithoutHash,
        responseHash
      };

      input.onLog?.({
        event: 'llm.gateway.invoke',
        provider: providerId,
        model: raw.model,
        outputMode: request.outputMode,
        responseHash,
        taskType: request.taskType,
        routeHint: request.routeHint ?? null
      });

      return response;
    }
  };
}
