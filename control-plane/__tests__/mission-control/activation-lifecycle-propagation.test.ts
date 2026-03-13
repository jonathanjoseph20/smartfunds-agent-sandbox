import { describe, expect, it } from 'vitest';

import {
  createActivationLifecyclePropagation,
  deriveActivationLifecyclePropagationClass,
} from '../../mission-control/activation-lifecycle-propagation.ts';

describe('activation lifecycle propagation', () => {
  it('T-ROP-A1 covers each activation lifecycle propagation class', () => {
    expect(deriveActivationLifecyclePropagationClass({ runtimeStatus: 'runtime_completed' })).toBe('activation_completed');
    expect(deriveActivationLifecyclePropagationClass({ runtimeStatus: 'runtime_failed' })).toBe('activation_failed');
    expect(deriveActivationLifecyclePropagationClass({ runtimeStatus: 'runtime_deferred' })).toBe('activation_deferred');
    expect(deriveActivationLifecyclePropagationClass({ runtimeStatus: 'inconclusive' })).toBe('activation_inconclusive');
    expect(deriveActivationLifecyclePropagationClass({ runtimeStatus: 'runtime_active' })).toBe('activation_retrying');
  });

  it('T-ROP-A2 creation is deterministic', () => {
    const one = createActivationLifecyclePropagation({
      runtimeOutcomePropagationRecordId: 'record-1',
      executionActivationRecordId: 'activation-1',
      runtimeStatus: 'runtime_completed',
      reasonTokens: ['b', 'a'],
    });

    const two = createActivationLifecyclePropagation({
      runtimeOutcomePropagationRecordId: 'record-1',
      executionActivationRecordId: 'activation-1',
      runtimeStatus: 'runtime_completed',
      reasonTokens: ['a', 'b'],
    });

    expect(one).toEqual(two);
  });
});
