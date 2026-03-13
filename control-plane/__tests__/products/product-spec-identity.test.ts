import { describe, expect, it } from 'vitest';

import { deriveProductSpecId } from '../../products/product-spec-identity.ts';

describe('product spec identity', () => {
  it('T-PF1-ID1 derives deterministic specId from canonical identity payload', () => {
    const first = deriveProductSpecId({
      name: 'Stratum Money Dashboard',
      problem: 'Users cannot inspect collateral ratios.',
      targetUser: 'Stratum ecosystem participants',
      solution: 'Transparency dashboard displaying reserves.',
      architectureSummary: 'React dashboard + API.',
      mvpScope: 'Dashboard with collateral ratios.',
      constraints: ['read-only', 'no-wallet-required'],
      dependencies: ['pricing-feed', 'reserve-api'],
      originMissionIds: ['mission-stratum-dashboard'],
    });

    const second = deriveProductSpecId({
      name: 'Stratum Money Dashboard',
      problem: 'Users cannot inspect collateral ratios.',
      targetUser: 'Stratum ecosystem participants',
      solution: 'Transparency dashboard displaying reserves.',
      architectureSummary: 'React dashboard + API.',
      mvpScope: 'Dashboard with collateral ratios.',
      constraints: ['no-wallet-required', 'read-only'],
      dependencies: ['reserve-api', 'pricing-feed'],
      originMissionIds: ['mission-stratum-dashboard'],
    });

    expect(first).toBe(second);
  });

  it('T-PF1-ID2 excludes non-identity metadata from specId derivation', () => {
    const payload = {
      name: 'Spec A',
      problem: 'Problem A',
      targetUser: 'User A',
      solution: 'Solution A',
      architectureSummary: 'Arch A',
      mvpScope: 'MVP A',
      constraints: ['c1'],
      dependencies: ['d1'],
      originMissionIds: ['m1'],
      status: 'validated',
      timestamp: '2026-03-13T00:00:00.000Z',
      artifactPath: 'artifacts/products/x',
    } as unknown as Parameters<typeof deriveProductSpecId>[0];

    const withNoise = deriveProductSpecId(payload);

    const withoutNoise = deriveProductSpecId({
      name: 'Spec A',
      problem: 'Problem A',
      targetUser: 'User A',
      solution: 'Solution A',
      architectureSummary: 'Arch A',
      mvpScope: 'MVP A',
      constraints: ['c1'],
      dependencies: ['d1'],
      originMissionIds: ['m1'],
    });

    expect(withNoise).toBe(withoutNoise);
  });
});
