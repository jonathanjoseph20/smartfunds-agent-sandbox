import { describe, expect, it, vi } from 'vitest';

import { fetchPullRequestMetadataFromGitHubAPI } from './pr-files-api.ts';

describe('pr files api', () => {
  it('retries transient GitHub 5xx responses and then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('temporary', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            body: 'tier-2',
            labels: [{ name: 'tier-2' }]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([{ filename: 'apps/api/src/index.ts' }]), { status: 200 }));

    const metadata = await fetchPullRequestMetadataFromGitHubAPI({
      owner: 'owner',
      repo: 'repo',
      pullNumber: 42,
      token: 'token',
      fetchImpl: fetchMock as unknown as typeof fetch
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(metadata.labels).toEqual(['tier-2']);
    expect(metadata.changedFiles).toEqual(['apps/api/src/index.ts']);
  });

  it('fails fast on 404 without retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));

    await expect(
      fetchPullRequestMetadataFromGitHubAPI({
        owner: 'owner',
        repo: 'repo',
        pullNumber: 99,
        token: 'token',
        fetchImpl: fetchMock as unknown as typeof fetch
      })
    ).rejects.toThrow('GitHub API request failed (404)');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
