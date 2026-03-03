import { describe, expect, it, vi } from 'vitest';

import { fetchWithGitHubRetry } from './github-retry.ts';

describe('github retry', () => {
  it('retries retryable 5xx responses with deterministic backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('temporary', { status: 500 }))
      .mockResolvedValueOnce(new Response('temporary', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const sleepCalls: number[] = [];

    const response = await fetchWithGitHubRetry(fetchMock as unknown as typeof fetch, 'https://api.github.com/test', {}, {
      sleep: async (ms) => {
        sleepCalls.push(ms);
      }
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleepCalls).toEqual([100, 200]);
  });

  it('fails fast on 403 without retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 }));
    const sleepSpy = vi.fn();

    const response = await fetchWithGitHubRetry(fetchMock as unknown as typeof fetch, 'https://api.github.com/test', {}, {
      sleep: async (ms) => {
        sleepSpy(ms);
      }
    });

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  it('stops after configured retries for persistent retryable failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 }));
    const sleepCalls: number[] = [];

    const response = await fetchWithGitHubRetry(fetchMock as unknown as typeof fetch, 'https://api.github.com/test', {}, {
      retries: 3,
      sleep: async (ms) => {
        sleepCalls.push(ms);
      }
    });

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(sleepCalls).toEqual([100, 200, 400]);
  });
});
