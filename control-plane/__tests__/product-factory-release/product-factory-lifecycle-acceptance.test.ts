import { describe, expect, it } from 'vitest';

import { deriveProductFactoryLifecycleAcceptance } from '../../product-factory-release/product-factory-lifecycle-acceptance.ts';
import type { ProductFactoryReleaseLayerSummary } from '../../product-factory-release/product-factory-release-acceptance-types.ts';

function summarize(state: ProductFactoryReleaseLayerSummary['state']): ProductFactoryReleaseLayerSummary[] {
  return [{
    layerId: 'layer-1',
    layerClass: 'product_spec',
    status: 'x',
    state,
    reasonTokens: [`state:${state}`],
  }];
}

describe('product factory lifecycle acceptance', () => {
  it('T-PF9-L1 lifecycle_complete', () => {
    const result = deriveProductFactoryLifecycleAcceptance({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      coveredLayerSummaries: summarize('accepted'),
    });

    expect(result.acceptanceClass).toBe('lifecycle_complete');
  });

  it('T-PF9-L2 lifecycle_partially_complete', () => {
    const result = deriveProductFactoryLifecycleAcceptance({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      coveredLayerSummaries: [
        ...summarize('accepted'),
        {
          layerId: 'layer-2',
          layerClass: 'engineering_plan',
          status: 'x',
          state: 'partial',
          reasonTokens: ['state:partial'],
        },
      ],
    });

    expect(result.acceptanceClass).toBe('lifecycle_partially_complete');
  });

  it('T-PF9-L3 lifecycle_blocked', () => {
    const result = deriveProductFactoryLifecycleAcceptance({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      coveredLayerSummaries: summarize('blocked'),
    });

    expect(result.acceptanceClass).toBe('lifecycle_blocked');
  });

  it('T-PF9-L4 lifecycle_failed', () => {
    const result = deriveProductFactoryLifecycleAcceptance({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      coveredLayerSummaries: summarize('failed'),
    });

    expect(result.acceptanceClass).toBe('lifecycle_failed');
  });

  it('T-PF9-L5 lifecycle_inconclusive', () => {
    const result = deriveProductFactoryLifecycleAcceptance({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      coveredLayerSummaries: summarize('inconclusive'),
    });

    expect(result.acceptanceClass).toBe('lifecycle_inconclusive');
  });
});
