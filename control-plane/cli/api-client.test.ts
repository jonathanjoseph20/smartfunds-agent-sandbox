import { afterEach, describe, expect, it, vi } from 'vitest';

import { createOperatorApiClient } from './api-client.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('operator api client', () => {
  it('T-S74-CLI1 maps mission:list to /missions contract', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        payload: [{ missionId: 'm1' }],
        meta: {
          source: 'operator-runtime-api',
          version: 'v1'
        }
      })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createOperatorApiClient('http://127.0.0.1:3100');
    const result = await client.listMissions();

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3100/missions', expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual([{ missionId: 'm1' }]);
  });

  it('T-S74-CLI2 returns deterministic error on API failure envelope', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'invalid'
        }
      })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createOperatorApiClient('http://127.0.0.1:3100');

    await expect(client.listMissions()).rejects.toThrowError('BAD_REQUEST: invalid');
  });
});
