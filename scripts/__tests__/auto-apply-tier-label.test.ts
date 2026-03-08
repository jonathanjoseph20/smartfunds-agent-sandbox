import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAutoApplyTierLabel } from '../auto-apply-tier-label.ts';

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function mockResponse(payload: unknown, ok = true, status = 200): MockResponse {
  return {
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  };
}

const ORIGINAL_ENV = { ...process.env };

describe('auto-apply-tier-label', () => {
  beforeEach(() => {
    process.exitCode = 0;
    process.env.GITHUB_TOKEN = 'token';
    process.env.GITHUB_REPOSITORY = 'owner/repo';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.exitCode = 0;
  });

  it('applies missing tier label from PR body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ body: 'tier-2\n\n```evidence\nRisk Tier: 2\n```', labels: [] }))
      .mockResolvedValueOnce(mockResponse({}));

    vi.stubGlobal('fetch', fetchMock);
    await runAutoApplyTierLabel(['--pr', '12']);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/issues/12/labels');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('tier-2');
  });

  it('does not reapply when tier label already exists', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ body: 'tier-1\n\n```evidence\nRisk Tier: 1\n```', labels: [{ name: 'tier-1' }] }));

    vi.stubGlobal('fetch', fetchMock);
    await runAutoApplyTierLabel(['--pr', '34']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
