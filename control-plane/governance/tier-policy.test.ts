import { describe, expect, it } from 'vitest';

import { classifyPaths, inferImpliedTierFromPaths } from './tier-policy.ts';

describe('tier policy', () => {
  it('T-M1 infers tier-0 for docs and markdown only paths', () => {
    const result = classifyPaths(['docs/runbooks/governance-workflow.md', 'README.md']);
    expect(result.impliedTier).toBe(0);
    expect(result.tier0Eligible).toBe(true);
    expect(result.tier1Eligible).toBe(true);
    expect(result.restrictedHits).toEqual([]);
  });

  it('T-M2 allows control-plane/projects/docs.json in tier-1 lane', () => {
    const result = classifyPaths(['control-plane/projects/docs.json']);
    expect(result.impliedTier).toBe(1);
    expect(result.tier0Eligible).toBe(false);
    expect(result.tier1Eligible).toBe(true);
    expect(result.restrictedHits).toEqual([]);
  });

  it('T-M3 infers tier-1 for mixed tier-0 and tier-1 allowlisted paths', () => {
    const impliedTier = inferImpliedTierFromPaths(['docs/guide.md', 'scripts/bootstrap-labels.sh']);
    expect(impliedTier).toBe(1);
  });

  it('T-M4 defaults unknown paths to tier-2 and marks restricted hits', () => {
    const result = classifyPaths(['apps/api/src/index.ts']);
    expect(result.impliedTier).toBe(2);
    expect(result.restrictedHits).toEqual(['apps/api/src/index.ts']);
  });

  it('T-M5 infers tier-3 for critical governance paths', () => {
    const result = classifyPaths(['.github/workflows/code-factory.yml', 'docs/runbooks/pr-creation.md']);
    expect(result.impliedTier).toBe(3);
    expect(result.restrictedHits).toEqual(['.github/workflows/code-factory.yml']);
  });
});
