import { describe, expect, it } from 'vitest';

import { getProviderStatus } from '../provider-status.ts';

describe('runtime llm provider status', () => {
  it('T-L6 returns unavailable when required env is missing', async () => {
    const status = await getProviderStatus({ providerId: 'openai', env: {}, checkReachability: false });
    expect(status).toBe('unavailable');
  });

  it('T-L7 returns configured for keyed providers when env exists', async () => {
    const status = await getProviderStatus({
      providerId: 'google',
      env: { GOOGLE_API_KEY: 'x' },
      checkReachability: false
    });
    expect(status).toBe('configured');
  });

  it('T-L8 returns reachable for ollama on successful tags call', async () => {
    const status = await getProviderStatus({
      providerId: 'ollama',
      env: { OLLAMA_BASE_URL: 'http://ollama.local' },
      fetchImpl: async () => ({ ok: true } as Response)
    });
    expect(status).toBe('reachable');
  });
});
