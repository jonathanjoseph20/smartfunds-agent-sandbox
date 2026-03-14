import { describe, expect, it } from 'vitest';

import { deriveProductFactoryReleaseAcceptanceRecordId } from '../../product-factory-release/product-factory-release-acceptance-identity.ts';
import { createProductFactoryReleaseAcceptanceRecord } from '../../product-factory-release/product-factory-release-acceptance-record.ts';

describe('product factory release acceptance record', () => {
  it('T-PF9-AR1 deterministic identity is stable for semantically equal payloads', () => {
    const first = deriveProductFactoryReleaseAcceptanceRecordId({
      releaseTrack: 'release-1',
      coveredLayerIds: ['product-spec:s1', 'commerce-intent:c1', 'build-run:r1'],
    });

    const second = deriveProductFactoryReleaseAcceptanceRecordId({
      releaseTrack: 'release-1',
      coveredLayerIds: ['build-run:r1', 'product-spec:s1', 'commerce-intent:c1'],
    });

    expect(first).toBe(second);
  });

  it('T-PF9-AR2 create deduplicates and orders covered layers', () => {
    const record = createProductFactoryReleaseAcceptanceRecord({
      releaseTrack: 'release-1',
      coveredLayerIds: ['b', 'a', 'a'],
      lifecycleAcceptanceId: 'l1',
      replayValidationId: 'r1',
      docsCompletenessId: 'd1',
      releaseHardeningId: 'h1',
      status: 'draft',
      outcome: 'not_ready',
    });

    expect(record.coveredLayerIds).toEqual(['a', 'b']);
  });
});
