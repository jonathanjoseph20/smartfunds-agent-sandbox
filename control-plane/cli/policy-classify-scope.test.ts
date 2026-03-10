import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main, parseArgs } from './policy-classify-scope.ts';

const classifyScope = vi.fn();

vi.mock('../policy/core-classification.ts', async () => {
  const actual = await vi.importActual<typeof import('../policy/core-classification.ts')>('../policy/core-classification.ts');
  return {
    ...actual,
    classifyScope: (...args: unknown[]) => classifyScope(...args)
  };
});

vi.mock('../policy/scope-registry.ts', () => ({
  loadScopeRegistry: vi.fn(() => ({
    version: 1,
    profiles: {
      lite: { mutationAllowed: false },
      build: { allowedRepos: ['smartfunds-agent-sandbox'] },
      core: { allowedRepos: ['smartfunds-agent-sandbox'] }
    }
  }))
}));

describe('policy-classify-scope CLI', () => {
  it('T-PCS1 parses arguments with deterministic path ordering', () => {
    expect(parseArgs([
      '--repo',
      'smartfunds-agent-sandbox',
      '--path',
      'docs/a.md',
      '--path',
      'apps/api/src/index.ts',
      '--path',
      'docs/a.md'
    ])).toEqual({
      repo: 'smartfunds-agent-sandbox',
      paths: ['apps/api/src/index.ts', 'docs/a.md']
    });
  });

  it('T-PCS2 prints deterministic JSON output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    classifyScope.mockReturnValueOnce({
      requiredProfile: 'build',
      reason: 'target_scope_matches_build_registry',
      coreScopeMatched: false,
      allowedForBuild: true,
      matchedBuildPaths: ['docs/a.md'],
      matchedCorePaths: [],
      unmatchedPaths: []
    });

    const code = await main(['--repo', 'smartfunds-agent-sandbox', '--path', 'docs/a.md']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      repo: 'smartfunds-agent-sandbox',
      paths: ['docs/a.md'],
      classification: {
        requiredProfile: 'build',
        reason: 'target_scope_matches_build_registry',
        coreScopeMatched: false,
        allowedForBuild: true,
        matchedBuildPaths: ['docs/a.md'],
        matchedCorePaths: [],
        unmatchedPaths: []
      }
    })}\n`);

    stdout.mockRestore();
  });

  it('T-PCS3 emits stable error JSON for missing repo', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main(['--path', 'docs/a.md']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --repo' })}\n`);

    stdout.mockRestore();
  });
});
