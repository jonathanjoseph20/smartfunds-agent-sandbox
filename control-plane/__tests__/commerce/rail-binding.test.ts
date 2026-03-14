import { describe, expect, it } from 'vitest';

import { deriveRailBindingsForChargeIntent } from '../../commerce/rail-binding.ts';
import type { ChargeIntent } from '../../commerce/charge-intent-types.ts';

function intent(railClasses: ChargeIntent['railClasses']): ChargeIntent {
  return {
    chargeIntentId: 'ci-1',
    buildEvidenceBundleId: 'be-1',
    runId: 'run-1',
    packetId: 'packet-1',
    bundleId: 'bundle-1',
    graphId: 'graph-1',
    taskId: 'task-1',
    planId: 'plan-1',
    productSpecId: 'spec-1',
    monetizationClass: 'artifact_delivery',
    amount: '99.00',
    currency: 'USD',
    payTo: 'smartfunds',
    railClasses,
    status: 'draft',
    outcome: 'pending_settlement',
  };
}

describe('rail binding', () => {
  it('T-PF8-RB1 stripe binding deterministic', () => {
    const bindings = deriveRailBindingsForChargeIntent(intent(['stripe']));
    expect(bindings[0]?.railClass).toBe('stripe');
    expect(bindings[0]?.bindingClass).toBe('primary_binding');
  });

  it('T-PF8-RB2 evm_wallet binding deterministic', () => {
    const bindings = deriveRailBindingsForChargeIntent(intent(['evm_wallet']));
    expect(bindings[0]?.railClass).toBe('evm_wallet');
  });

  it('T-PF8-RB3 erebor binding deterministic', () => {
    const bindings = deriveRailBindingsForChargeIntent(intent(['erebor']));
    expect(bindings[0]?.railClass).toBe('erebor');
  });

  it('T-PF8-RB4 blocked binding when no rail classes', () => {
    const bindings = deriveRailBindingsForChargeIntent(intent([]));
    expect(bindings[0]?.bindingClass).toBe('blocked_binding');
    expect(bindings[0]?.state).toBe('blocked');
  });
});
