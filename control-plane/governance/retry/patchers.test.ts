import { describe, expect, it } from 'vitest';

import { applyMissingEvidenceRiskTier, applyMissingTierDeclaration } from './patchers.ts';

describe('retry patchers', () => {
  it('adds missing tier declaration at top deterministically', () => {
    const body = 'Title\n\n```evidence\nJustification: present\n```';
    const patched = applyMissingTierDeclaration(body);

    expect(patched.patchApplied).toBe('ADD_TIER_DECLARATION');
    expect(patched.nextBody).toBe('tier-3\n\nTitle\n\n```evidence\nJustification: present\n```');
  });

  it('normalizes multiple tier declarations to one tier-3 when safe', () => {
    const body = 'tier-1\n\nnotes\ntier-2\n';
    const patched = applyMissingTierDeclaration(body);

    expect(patched.patchApplied).toBe('ADD_TIER_DECLARATION');
    expect(patched.nextBody).toBe('tier-3\n\nnotes');
  });

  it('is deterministic no-op for unsafe tier lines', () => {
    const body = 'tier-critical\n\nnotes';
    const patched = applyMissingTierDeclaration(body);

    expect(patched.patchApplied).toBeNull();
    expect(patched.nextBody).toBe('tier-critical\n\nnotes');
  });

  it('adds missing risk tier in evidence block and is idempotent', () => {
    const body = 'tier-1\n\n```evidence\nJustification: x\n```';
    const first = applyMissingEvidenceRiskTier(body, 1);
    const second = applyMissingEvidenceRiskTier(first.nextBody, 1);

    expect(first.patchApplied).toBe('ADD_EVIDENCE_RISK_TIER');
    expect(first.nextBody).toBe('tier-1\n\n```evidence\nRisk Tier: 1\nJustification: x\n```');
    expect(second.patchApplied).toBeNull();
    expect(second.nextBody).toBe(first.nextBody);
  });

  it('appends evidence block with risk tier when missing', () => {
    const body = 'tier-2';
    const patched = applyMissingEvidenceRiskTier(body, 2);

    expect(patched.patchApplied).toBe('ADD_EVIDENCE_RISK_TIER');
    expect(patched.nextBody).toBe('tier-2\n\n```evidence\nRisk Tier: 2\n```');
  });
});
