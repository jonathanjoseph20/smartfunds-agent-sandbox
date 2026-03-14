import { describe, expect, it } from 'vitest';

import { deriveRailBindingsForChargeIntent } from '../../commerce/rail-binding.ts';
import { deriveRailEligibilityForBindings } from '../../commerce/rail-eligibility.ts';
import type { ChargeIntent } from '../../commerce/charge-intent-types.ts';

function intent(input: { railClasses: ChargeIntent['railClasses']; currency: string; amount?: string }): ChargeIntent {
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
    amount: input.amount ?? '99.00',
    currency: input.currency,
    payTo: 'smartfunds',
    railClasses: input.railClasses,
    status: 'draft',
    outcome: 'pending_settlement',
  };
}

describe('rail eligibility', () => {
  it('T-PF8-RE1 eligible', () => {
    const chargeIntent = intent({ railClasses: ['stripe'], currency: 'USD' });
    const eligibility = deriveRailEligibilityForBindings({ chargeIntent, railBindings: deriveRailBindingsForChargeIntent(chargeIntent) });
    expect(eligibility[0]?.eligibilityStatus).toBe('eligible');
  });

  it('T-PF8-RE2 conditionally_eligible', () => {
    const chargeIntent = intent({ railClasses: ['evm_wallet'], currency: 'USD' });
    const eligibility = deriveRailEligibilityForBindings({ chargeIntent, railBindings: deriveRailBindingsForChargeIntent(chargeIntent) });
    expect(eligibility[0]?.eligibilityStatus).toBe('conditionally_eligible');
  });

  it('T-PF8-RE3 blocked', () => {
    const chargeIntent = intent({ railClasses: ['erebor'], currency: 'USD', amount: '1000001.00' });
    const eligibility = deriveRailEligibilityForBindings({ chargeIntent, railBindings: deriveRailBindingsForChargeIntent(chargeIntent) });
    expect(eligibility[0]?.eligibilityStatus).toBe('blocked');
  });

  it('T-PF8-RE4 incompatible', () => {
    const chargeIntent = intent({ railClasses: ['stripe'], currency: 'ETH' });
    const eligibility = deriveRailEligibilityForBindings({ chargeIntent, railBindings: deriveRailBindingsForChargeIntent(chargeIntent) });
    expect(eligibility[0]?.eligibilityStatus).toBe('incompatible');
  });

  it('T-PF8-RE5 inconclusive', () => {
    const chargeIntent = intent({ railClasses: ['erebor'], currency: 'ETH' });
    const eligibility = deriveRailEligibilityForBindings({ chargeIntent, railBindings: deriveRailBindingsForChargeIntent(chargeIntent) });
    expect(eligibility[0]?.eligibilityStatus).toBe('inconclusive');
  });
});
