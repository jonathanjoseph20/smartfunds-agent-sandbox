import { describe, expect, it } from 'vitest';

import { deriveProductFactoryReplayValidation } from '../../product-factory-release/product-factory-replay-validation.ts';

describe('product factory replay validation', () => {
  it('T-PF9-R1 replay_validated', () => {
    const result = deriveProductFactoryReplayValidation({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      checks: [{ subsystemId: 's1', state: 'pass', reasonToken: 'ok' }],
    });

    expect(result.validationClass).toBe('replay_validated');
  });

  it('T-PF9-R2 replay_blocked', () => {
    const result = deriveProductFactoryReplayValidation({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      checks: [{ subsystemId: 's1', state: 'blocked', reasonToken: 'blocked' }],
    });

    expect(result.validationClass).toBe('replay_blocked');
  });

  it('T-PF9-R3 replay_failed', () => {
    const result = deriveProductFactoryReplayValidation({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      checks: [{ subsystemId: 's1', state: 'failed', reasonToken: 'failed' }],
    });

    expect(result.validationClass).toBe('replay_failed');
  });

  it('T-PF9-R4 replay_inconclusive', () => {
    const result = deriveProductFactoryReplayValidation({
      productFactoryReleaseAcceptanceRecordId: 'release-1',
      checks: [],
    });

    expect(result.validationClass).toBe('replay_inconclusive');
  });
});
