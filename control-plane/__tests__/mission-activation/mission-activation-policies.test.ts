import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MISSION_ACTIVATION_POLICY_ID,
  getMissionActivationPolicy,
  listMissionActivationPolicies,
} from '../../mission-activation/mission-activation-policies.ts';

describe('mission activation policies', () => {
  it('T-MACT-P1 default policy is strict-founder-gated-activation', () => {
    expect(DEFAULT_MISSION_ACTIVATION_POLICY_ID).toBe('strict-founder-gated-activation');
  });

  it('T-MACT-P2 seeded policies include strict founder gated, confirmed assignment default, and manual gate only', () => {
    const ids = listMissionActivationPolicies().map((entry) => entry.activationPolicyId);
    expect(ids).toEqual([
      'confirmed-assignment-default',
      'manual-gate-only',
      'strict-founder-gated-activation',
    ]);
  });

  it('T-MACT-P3 strict founder policy requires explicit activation confirmation', () => {
    const policy = getMissionActivationPolicy('strict-founder-gated-activation');
    expect(policy.requiresFounderActivationConfirmation).toBe(true);
    expect(policy.requiresConfirmedAssignment).toBe(true);
  });

  it('T-MACT-P4 confirmed assignment default does not require explicit activation confirmation', () => {
    const policy = getMissionActivationPolicy('confirmed-assignment-default');
    expect(policy.requiresFounderActivationConfirmation).toBe(false);
    expect(policy.requiresConfirmedAssignment).toBe(true);
  });

  it('T-MACT-P5 manual gate only can be loaded', () => {
    const policy = getMissionActivationPolicy('manual-gate-only');
    expect(policy.activationPolicyId).toBe('manual-gate-only');
  });
});
