import type { LLMProvider } from './providers/provider.ts';

export type ProviderStatus = 'configured' | 'reachable' | 'unavailable';

function requireEnv(key: string, env: NodeJS.ProcessEnv): boolean {
  return typeof env[key] === 'string' && env[key]!.trim().length > 0;
}

function isConfigured(providerId: string, env: NodeJS.ProcessEnv): boolean {
  if (providerId === 'ollama') {
    return true;
  }

  const envMap: Record<string, string> = {
    groq: 'GROQ_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    google: 'GOOGLE_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY'
  };

  const key = envMap[providerId];
  return key ? requireEnv(key, env) : false;
}

async function isReachable(providerId: string, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<boolean> {
  if (providerId !== 'ollama') {
    return isConfigured(providerId, env);
  }

  const baseUrl = env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/tags`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getProviderStatus(input: {
  providerId: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  checkReachability?: boolean;
}): Promise<ProviderStatus> {
  const env = input.env ?? process.env;
  if (!isConfigured(input.providerId, env)) {
    return 'unavailable';
  }

  if (input.checkReachability === false) {
    return 'configured';
  }

  const reachable = await isReachable(input.providerId, env, input.fetchImpl ?? fetch);
  return reachable ? 'reachable' : 'unavailable';
}

export async function assertProviderAvailable(input: {
  provider: LLMProvider;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  checkReachability?: boolean;
}): Promise<void> {
  const status = await getProviderStatus({
    providerId: input.provider.providerId,
    env: input.env,
    fetchImpl: input.fetchImpl,
    checkReachability: input.checkReachability
  });

  if (status === 'unavailable') {
    throw new Error(`LLM_PROVIDER_UNAVAILABLE: provider=${input.provider.providerId}`);
  }
}
