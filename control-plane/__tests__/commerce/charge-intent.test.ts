import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCommerceManager } from '../../commerce/commerce-manager.ts';

import { cleanupTmpRoot, createUpstreamFixture } from './test-helpers.ts';

const tmpRoot = path.join('control-plane', 'tests', 'commerce', 'tmp-charge-intent');

afterEach(() => {
  cleanupTmpRoot(tmpRoot);
});

describe('charge intent', () => {
  it('T-PF8-CI1 deterministic identity and duplicate intent idempotence', () => {
    const fixture = createUpstreamFixture(tmpRoot);

    const manager = createCommerceManager({
      commerceFilePath: path.join(tmpRoot, 'state', 'commerce.json'),
      historyFilePath: path.join(tmpRoot, 'state', 'commerce-history.json'),
      ...fixture.paths,
    });

    const first = manager.createChargeIntent({
      buildEvidenceBundleId: fixture.ids.buildEvidenceBundleId,
      monetizationClass: 'artifact_delivery',
    });

    const second = manager.createChargeIntent({
      buildEvidenceBundleId: fixture.ids.buildEvidenceBundleId,
      monetizationClass: 'artifact_delivery',
    });

    expect(first.chargeIntentId).toBe(second.chargeIntentId);
    expect(manager.listChargeIntents()).toHaveLength(1);
  });

  it('T-PF8-CI2 deterministic rail ordering is stable', () => {
    const fixture = createUpstreamFixture(tmpRoot);

    const manager = createCommerceManager({
      commerceFilePath: path.join(tmpRoot, 'state', 'commerce.json'),
      historyFilePath: path.join(tmpRoot, 'state', 'commerce-history.json'),
      ...fixture.paths,
    });

    const created = manager.createChargeIntent({
      buildEvidenceBundleId: fixture.ids.buildEvidenceBundleId,
      railClasses: ['erebor', 'stripe', 'evm_wallet'],
    });

    const projection = manager.deriveCommerceProjection(created.chargeIntentId);
    const classes = projection.railBindingSummaries.map((entry) => entry.railClass);

    expect(classes).toEqual(['erebor', 'evm_wallet', 'stripe']);
  });
});
