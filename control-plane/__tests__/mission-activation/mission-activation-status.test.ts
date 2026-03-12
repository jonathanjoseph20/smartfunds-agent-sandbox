import { describe, expect, it } from 'vitest';

import { getMissionActivationPolicy } from '../../mission-activation/mission-activation-policies.ts';
import { deriveMissionActivationStatus } from '../../mission-activation/mission-activation-status.ts';
import type { ActivationPreconditionResult } from '../../mission-activation/mission-activation-types.ts';

function precondition(overrides: Partial<ActivationPreconditionResult>): ActivationPreconditionResult {
  return {
    preconditionId: 'p1',
    category: 'mission_state',
    state: 'satisfied',
    reasonTokens: [],
    blockingReasons: [],
    limitations: [],
    ...overrides,
  };
}

describe('mission activation status', () => {
  it('T-MACT-S1 derives evaluated for non-blocked waiting-on-dependencies without manual gate', () => {
    const status = deriveMissionActivationStatus({
      policy: getMissionActivationPolicy('confirmed-assignment-default'),
      activationMode: 'policy_evaluated',
      preconditionResults: [
        precondition({ category: 'mission_state', state: 'satisfied' }),
        precondition({ category: 'mission_readiness', preconditionId: 'p2', state: 'waiting' }),
      ],
    });

    expect(status.executionReadinessState).toBe('waiting_on_dependencies');
    expect(status.activationState).toBe('evaluated');
  });

  it('T-MACT-S2 derives under_review when waiting on activation confirmation', () => {
    const status = deriveMissionActivationStatus({
      policy: getMissionActivationPolicy('strict-founder-gated-activation'),
      activationMode: 'founder_review_required',
      preconditionResults: [
        precondition({ category: 'mission_state', state: 'satisfied' }),
        precondition({ category: 'activation_confirmation', preconditionId: 'p2', state: 'waiting' }),
      ],
    });

    expect(status.executionReadinessState).toBe('waiting_on_confirmation');
    expect(status.activationState).toBe('under_review');
  });

  it('T-MACT-S3 derives ready_for_activation when all preconditions are satisfied', () => {
    const status = deriveMissionActivationStatus({
      policy: getMissionActivationPolicy('confirmed-assignment-default'),
      activationMode: 'policy_evaluated',
      preconditionResults: [
        precondition({ category: 'mission_state', state: 'satisfied' }),
        precondition({ category: 'team_readiness', preconditionId: 'p2', state: 'satisfied' }),
      ],
    });

    expect(status.executionReadinessState).toBe('ready');
    expect(status.activationState).toBe('ready_for_activation');
  });

  it('T-MACT-S4 derives blocked when any blocker exists', () => {
    const status = deriveMissionActivationStatus({
      policy: getMissionActivationPolicy('confirmed-assignment-default'),
      activationMode: 'policy_evaluated',
      preconditionResults: [
        precondition({ category: 'team_availability', state: 'blocked', blockingReasons: ['team_unavailable'] }),
      ],
    });

    expect(status.executionReadinessState).toBe('blocked');
    expect(status.activationState).toBe('blocked');
  });

  it('T-MACT-S5 derives rejected from explicit rejection history event', () => {
    const status = deriveMissionActivationStatus({
      policy: getMissionActivationPolicy('strict-founder-gated-activation'),
      activationMode: 'founder_review_required',
      preconditionResults: [
        precondition({ category: 'activation_confirmation', state: 'waiting' }),
      ],
      historyEntries: [{
        activationDecisionId: 'a1',
        missionId: 'm1',
        eventType: 'activation_rejected',
        eventDedupeKey: 'k1',
        reasoning: 'rejected',
        payload: {},
      }],
    });

    expect(status.activationState).toBe('rejected');
  });
});
