import { describe, expect, it, vi } from 'vitest';

import { ensureLabels } from './bootstrap-labels';

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

describe('bootstrap-labels', () => {
  it('creates missing labels', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse([]))
      .mockResolvedValue(mockResponse({}));

    const summary = await ensureLabels({
      repo: 'owner/repo',
      token: 'token',
      yes: true,
      requiredLabels: [
        { name: 'tier-0', color: 'ededed', description: 'Cosmetic / docs-only' },
        { name: 'tier-1', color: '0e8a16', description: 'Low risk change' }
      ],
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    expect(summary.created).toEqual(['tier-0', 'tier-1']);
    expect(summary.updated).toEqual([]);
    expect(summary.unchanged).toEqual([]);

    const methods = fetchMock.mock.calls.map((call) => call[1]?.method ?? 'GET');
    expect(methods).toEqual(['GET', 'POST', 'POST']);
  });

  it('updates existing labels when color or description differ', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse([
          { name: 'tier-0', color: 'ffffff', description: 'Old description' },
          { name: 'tier-1', color: '0e8a16', description: 'Low risk change' }
        ])
      )
      .mockResolvedValue(mockResponse({}));

    const summary = await ensureLabels({
      repo: 'owner/repo',
      token: 'token',
      yes: true,
      requiredLabels: [
        { name: 'tier-0', color: 'ededed', description: 'Cosmetic / docs-only' },
        { name: 'tier-1', color: '0e8a16', description: 'Low risk change' }
      ],
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    expect(summary.created).toEqual([]);
    expect(summary.updated).toEqual(['tier-0']);
    expect(summary.unchanged).toEqual(['tier-1']);

    const methods = fetchMock.mock.calls.map((call) => call[1]?.method ?? 'GET');
    expect(methods).toEqual(['GET', 'PATCH']);
  });

  it('does not mutate labels during dry-run', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      mockResponse([
        { name: 'tier-0', color: 'ffffff', description: 'Old description' },
        { name: 'tier-1', color: '0e8a16', description: 'Low risk change' }
      ])
    );

    const summary = await ensureLabels({
      repo: 'owner/repo',
      token: 'token',
      yes: true,
      dryRun: true,
      requiredLabels: [
        { name: 'tier-0', color: 'ededed', description: 'Cosmetic / docs-only' },
        { name: 'tier-1', color: '0e8a16', description: 'Low risk change' }
      ],
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    expect(summary.created).toEqual([]);
    expect(summary.updated).toEqual(['tier-0']);
    expect(summary.unchanged).toEqual(['tier-1']);

    const methods = fetchMock.mock.calls.map((call) => call[1]?.method ?? 'GET');
    expect(methods).toEqual(['GET']);
  });
});
