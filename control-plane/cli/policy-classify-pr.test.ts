import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main, parseArgs } from './policy-classify-pr.ts';

const resolvePullRequestMetadata = vi.fn();
const routePrGovernanceProfile = vi.fn();

vi.mock('../governance/pr-files-api.ts', async () => {
  const actual = await vi.importActual<typeof import('../governance/pr-files-api.ts')>('../governance/pr-files-api.ts');
  return {
    ...actual,
    resolvePullRequestMetadata: (...args: unknown[]) => resolvePullRequestMetadata(...args)
  };
});

vi.mock('../policy/pr-profile-routing.ts', async () => {
  const actual = await vi.importActual<typeof import('../policy/pr-profile-routing.ts')>('../policy/pr-profile-routing.ts');
  return {
    ...actual,
    routePrGovernanceProfile: (...args: unknown[]) => routePrGovernanceProfile(...args)
  };
});

describe('policy-classify-pr CLI', () => {
  it('T-PCPR1 parses repo and pr arguments', () => {
    expect(parseArgs(['--repo', 'acme/smartfunds-agent-sandbox', '--pr', '77'])).toEqual({
      repo: 'acme/smartfunds-agent-sandbox',
      pr: 77
    });
  });

  it('T-PCPR2 prints deterministic classification output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    resolvePullRequestMetadata.mockResolvedValueOnce({
      pullNumber: 77,
      body: 'profile: build',
      labels: [],
      changedFiles: ['docs/a.md'],
      source: 'api',
      warnings: []
    });

    routePrGovernanceProfile.mockReturnValueOnce({
      ok: true,
      profile: 'build',
      requestedProfile: 'build',
      requiredProfile: 'build',
      finalProfile: 'build',
      matchedScopes: ['docs/a.md'],
      source: 'metadata',
      changedFiles: ['docs/a.md'],
      errors: []
    });

    const code = await main(['--repo', 'acme/smartfunds-agent-sandbox', '--pr', '77']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      profile: 'build',
      requestedProfile: 'build',
      requiredProfile: 'build',
      finalProfile: 'build',
      matchedScopes: ['docs/a.md'],
      source: 'metadata'
    })}\n`);

    stdout.mockRestore();
  });

  it('T-PCPR3 emits stable error JSON for invalid args', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main(['--repo', 'acme/smartfunds-agent-sandbox']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --pr' })}\n`);

    stdout.mockRestore();
  });
});
