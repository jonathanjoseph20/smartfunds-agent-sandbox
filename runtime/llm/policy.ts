import fs from 'node:fs';
import path from 'node:path';
import type { LLMRequest } from './types.ts';

export interface ProviderPolicy {
  default: string;
  [taskType: string]: string;
}

export interface ProviderModels {
  defaultModelByProvider: Record<string, string>;
}

const DEFAULT_POLICY_PATH = 'control-plane/llm/policy.json';
const DEFAULT_MODELS_PATH = 'control-plane/llm/models.json';

function resolveConfigPath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  let current = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(current, filePath);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return path.resolve(filePath);
}

function readJson(filePath: string): unknown {
  const resolved = resolveConfigPath(filePath);
  return JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toProviderPolicy(value: unknown): ProviderPolicy {
  if (!isRecord(value)) {
    throw new Error('LLM_POLICY_INVALID: policy must be an object');
  }

  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  const parsed: Record<string, string> = {};
  for (const [key, provider] of entries) {
    if (typeof provider !== 'string' || provider.trim().length === 0) {
      throw new Error(`LLM_POLICY_INVALID: invalid provider mapping for key=${key}`);
    }
    parsed[key] = provider;
  }

  if (typeof parsed.default !== 'string' || parsed.default.length === 0) {
    throw new Error('LLM_POLICY_INVALID: missing default provider');
  }

  return parsed as ProviderPolicy;
}

function toProviderModels(value: unknown): ProviderModels {
  if (!isRecord(value)) {
    throw new Error('LLM_MODELS_INVALID: models must be an object');
  }

  const rawMap = value.defaultModelByProvider;
  if (!isRecord(rawMap)) {
    throw new Error('LLM_MODELS_INVALID: missing defaultModelByProvider');
  }

  const entries = Object.entries(rawMap)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([provider, model]) => {
      if (typeof model !== 'string' || model.trim().length === 0) {
        throw new Error(`LLM_MODELS_INVALID: invalid model for provider=${provider}`);
      }
      return [provider, model] as const;
    });

  return {
    defaultModelByProvider: Object.fromEntries(entries)
  };
}

export function loadProviderPolicy(filePath = DEFAULT_POLICY_PATH): ProviderPolicy {
  return toProviderPolicy(readJson(filePath));
}

export function loadProviderModels(filePath = DEFAULT_MODELS_PATH): ProviderModels {
  return toProviderModels(readJson(filePath));
}

export function resolveProviderForRequest(request: LLMRequest, policy: ProviderPolicy): string {
  if (typeof request.providerPreference === 'string' && request.providerPreference.trim().length > 0) {
    return request.providerPreference;
  }

  if (typeof request.routeHint === 'string' && request.routeHint.trim().length > 0 && typeof policy[request.routeHint] === 'string') {
    return policy[request.routeHint];
  }

  if (typeof policy[request.taskType] === 'string') {
    return policy[request.taskType];
  }

  return policy.default;
}

export function resolveModelForProvider(provider: string, models: ProviderModels): string {
  const model = models.defaultModelByProvider[provider];
  if (!model) {
    throw new Error(`LLM_MODEL_NOT_FOUND: provider=${provider}`);
  }
  return model;
}
