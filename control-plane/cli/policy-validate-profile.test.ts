import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main, parseArgs } from './policy-validate-profile.ts';

const validateProfileRequest = vi.fn();

vi.mock('../policy/profile-validation.ts', () => ({
  validateProfileRequest: (...args: unknown[]) => validateProfileRequest(...args)
}));

describe('policy-validate-profile CLI', () => {
  it('T-PVP1 parses profile validation args deterministically', () => {
    expect(parseArgs([
      '--profile',
      'build',
      '--capability',
      'repo_write',
      '--capability',
      'read',
      '--intent',
      'code_change',
      '--repo',
      'smartfunds-agent-sandbox',
      '--path',
      'docs/a.md',
      '--path',
      'dashboard/ui/index.html'
    ])).toEqual({
      profile: 'build',
      capabilities: ['read', 'repo_write'],
      mutationIntent: 'code_change',
      repo: 'smartfunds-agent-sandbox',
      paths: ['dashboard/ui/index.html', 'docs/a.md']
    });
  });

  it('T-PVP2 prints deterministic validation JSON output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    validateProfileRequest.mockReturnValueOnce({
      ok: true,
      requestedProfile: 'build',
      requiredProfile: 'build',
      profile: 'build',
      scopeClassification: {
        requiredProfile: 'build',
        reason: 'target_scope_matches_build_registry',
        coreScopeMatched: false,
        allowedForBuild: true,
        matchedBuildPaths: ['docs/a.md'],
        matchedCorePaths: [],
        unmatchedPaths: []
      },
      coreScopeMatched: false,
      coreReasons: [],
      mutationIntentClassification: {
        intent: 'code_change',
        normalizedIntent: 'code_change',
        requiredProfile: 'build',
        reason: 'mutation_intent_allowed_for_build_profile'
      },
      capabilityClassifications: [],
      violations: [],
      allowedCapabilities: ['artifact_write', 'pr_open', 'read', 'repo_write']
    });

    const code = await main([
      '--profile',
      'build',
      '--capability',
      'repo_write',
      '--intent',
      'code_change',
      '--repo',
      'smartfunds-agent-sandbox',
      '--path',
      'docs/a.md'
    ]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      profile: 'build',
      capabilities: ['repo_write'],
      mutationIntent: 'code_change',
      targetScope: {
        repo: 'smartfunds-agent-sandbox',
        paths: ['docs/a.md']
      },
      validation: {
        ok: true,
        requestedProfile: 'build',
        requiredProfile: 'build',
        profile: 'build',
        scopeClassification: {
          requiredProfile: 'build',
          reason: 'target_scope_matches_build_registry',
          coreScopeMatched: false,
          allowedForBuild: true,
          matchedBuildPaths: ['docs/a.md'],
          matchedCorePaths: [],
          unmatchedPaths: []
        },
        coreScopeMatched: false,
        coreReasons: [],
        mutationIntentClassification: {
          intent: 'code_change',
          normalizedIntent: 'code_change',
          requiredProfile: 'build',
          reason: 'mutation_intent_allowed_for_build_profile'
        },
        capabilityClassifications: [],
        violations: [],
        allowedCapabilities: ['artifact_write', 'pr_open', 'read', 'repo_write']
      }
    })}\n`);

    stdout.mockRestore();
  });

  it('T-PVP3 returns stable parse error JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main(['--intent', 'code_change']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --profile' })}\n`);

    stdout.mockRestore();
  });
});
