import { describe, expect, it } from 'vitest';

import { buildPreflightReport, shouldWarnStaleMetadata } from './governance-preflight';

describe('governance:preflight', () => {
  it('treats missing legacy evidence as non-blocking', () => {
    const result = buildPreflightReport('', ['apps/api/src/index.ts'], []);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.declaredTier).toBeNull();
    expect(result.impliedTier).toBeNull();
    expect(result.tier3Approval).toEqual({ required: false, satisfied: true });
  });

  it('keeps legacy tier labels inert', () => {
    const result = buildPreflightReport('tier-1\n\n```evidence\nRisk Tier: 3\n```', ['apps/api/src/index.ts'], ['tier-3']);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.report.missingLabels).toEqual([]);
  });

  it('does not warn on stale metadata for legacy tier/evidence state', () => {
    expect(shouldWarnStaleMetadata({
      bodyMtimeMs: Date.now(),
      headCommitMs: Date.now() - 1_000,
      markerExists: true,
      declaredTier: null,
      tier3ApprovalSatisfied: false
    })).toBe(false);
  });
});
