import { describe, expect, it } from 'vitest';

import { createExecutionContractEvaluator } from '../../execution-contract/execution-contract-evaluator.ts';

interface FixtureOverrides {
  missionMissing?: boolean;
  assignmentMissing?: boolean;
  assignmentDecisionState?: string;
  selectedTeamId?: string;
  activationMissing?: boolean;
  activationState?: string;
  activationExecutionReadinessState?: string;
  teamProjectionMissing?: boolean;
  teamAvailabilityState?: string;
  teamReadinessState?: string;
}

function createEvaluator(overrides: FixtureOverrides = {}) {
  const missionProjection = {
    projectOne: (missionId: string) => {
      if (overrides.missionMissing) {
        throw new Error('MISSION_NOT_FOUND');
      }
      return {
        missionId,
        missionType: 'generate-product-spec',
        displayName: 'Generate Product Spec',
        definition: { tags: ['product', 'mvp'] },
        instance: {
          objective: 'Generate an MVP-ready product specification.',
          missionTemplateId: 'generate-product-spec',
          requestedDeliverables: [{ deliverableId: 'product-spec' }, { deliverableId: 'roadmap' }],
          createdFrom: { kind: 'founder_directive' },
        },
      };
    },
    projectAll: () => ([{ missionId: 'mission-1' }]),
  };

  const assignmentProjection = {
    projectOne: () => {
      if (overrides.assignmentMissing) {
        throw new Error('ASSIGNMENT_NOT_FOUND');
      }
      return {
        assignmentDecisionId: 'assignment-1',
        missionId: 'mission-1',
        selectedTeamId: overrides.selectedTeamId ?? 'team-a',
        decisionState: overrides.assignmentDecisionState ?? 'confirmed',
      };
    },
  };

  const activationProjection = {
    projectOne: () => {
      if (overrides.activationMissing) {
        throw new Error('ACTIVATION_NOT_FOUND');
      }
      return {
        activationDecisionId: 'activation-1',
        missionId: 'mission-1',
        activationState: overrides.activationState ?? 'ready_for_activation',
        executionReadinessState: overrides.activationExecutionReadinessState ?? 'ready',
      };
    },
  };

  const teamProjection = {
    projectOne: () => {
      if (overrides.teamProjectionMissing) {
        throw new Error('TEAM_NOT_FOUND');
      }
      return {
        status: {
          availabilityState: overrides.teamAvailabilityState ?? 'available',
          readinessState: overrides.teamReadinessState ?? 'ready',
        },
      };
    },
  };

  return createExecutionContractEvaluator({
    missionProjection: missionProjection as never,
    assignmentProjection: assignmentProjection as never,
    activationProjection: activationProjection as never,
    teamProjection: teamProjection as never,
  });
}

describe('execution contract evaluator', () => {
  it('T-MEC-E1 computes fully ready execution contract', () => {
    const evaluator = createEvaluator();
    const result = evaluator.evaluateExecutionContract({
      missionId: 'mission-1',
      executionPolicyId: 'operator-reviewed-contract',
    });

    expect(result.executionContract.executionEligibilityState).toBe('eligible');
    expect(result.executionContract.contractState).toBe('ready_for_runtime_handoff');
    expect(result.executionContract.executionTarget).toBe('team_runtime');
  });

  it('T-MEC-E2 computes waiting_on_runtime_preparation when governance confirmation is pending', () => {
    const evaluator = createEvaluator();
    const result = evaluator.evaluateExecutionContract({
      missionId: 'mission-1',
      executionPolicyId: 'strict-runtime-handoff-default',
    });

    expect(result.executionContract.executionEligibilityState).toBe('waiting_on_runtime_preparation');
    expect(result.executionContract.contractState).toBe('under_review');
  });

  it('T-MEC-E3 computes blocked when activation is blocked', () => {
    const evaluator = createEvaluator({ activationState: 'blocked', activationExecutionReadinessState: 'blocked' });
    const result = evaluator.evaluateExecutionContract({
      missionId: 'mission-1',
      executionPolicyId: 'operator-reviewed-contract',
    });

    expect(result.executionContract.executionEligibilityState).toBe('blocked');
    expect(result.executionContract.remainingBlockers).toContain('activation_not_ready_hard_block');
  });

  it('T-MEC-E4 computes incomplete when assignment is missing', () => {
    const evaluator = createEvaluator({ assignmentMissing: true, activationMissing: true });
    const result = evaluator.evaluateExecutionContract({
      missionId: 'mission-1',
      executionPolicyId: 'operator-reviewed-contract',
    });

    expect(result.executionContract.executionEligibilityState).toBe('incomplete');
    expect(result.executionContract.contractState).toBe('evaluated');
  });

  it('T-MEC-E5 computes blocked when selected team is unavailable', () => {
    const evaluator = createEvaluator({ teamAvailabilityState: 'unavailable' });
    const result = evaluator.evaluateExecutionContract({
      missionId: 'mission-1',
      executionPolicyId: 'operator-reviewed-contract',
    });

    expect(result.executionContract.executionEligibilityState).toBe('blocked');
    expect(result.executionContract.remainingBlockers).toContain('selected_team_unavailable');
  });

  it('T-MEC-E6 computes missing target when selected team is absent', () => {
    const evaluator = createEvaluator({ selectedTeamId: '', activationMissing: true });
    const result = evaluator.evaluateExecutionContract({
      missionId: 'mission-1',
      executionPolicyId: 'operator-reviewed-contract',
    });

    expect(result.executionContract.executionTarget).toBe('unassigned_target');
    expect(result.executionContract.executionEligibilityState).toBe('incomplete');
  });

  it('T-MEC-E7 computes inconclusive when upstream team state is inconclusive', () => {
    const evaluator = createEvaluator({ teamProjectionMissing: true });
    const result = evaluator.evaluateExecutionContract({
      missionId: 'mission-1',
      executionPolicyId: 'operator-reviewed-contract',
    });

    expect(result.executionContract.executionEligibilityState).toBe('inconclusive');
  });

  it('T-MEC-E8 repeated evaluation with identical inputs is deterministic', () => {
    const evaluator = createEvaluator();

    const first = evaluator.evaluateExecutionContract({ missionId: 'mission-1', executionPolicyId: 'operator-reviewed-contract' });
    const second = evaluator.evaluateExecutionContract({ missionId: 'mission-1', executionPolicyId: 'operator-reviewed-contract' });

    expect(first).toEqual(second);
    expect(first.executionContract.executionContractId).toBe(second.executionContract.executionContractId);
    expect(first.executionContract.executionContractId).toHaveLength(64);
  });
});
