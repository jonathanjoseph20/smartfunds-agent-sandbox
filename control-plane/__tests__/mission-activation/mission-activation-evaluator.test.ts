import { describe, expect, it } from 'vitest';

import { createMissionActivationEvaluator } from '../../mission-activation/mission-activation-evaluator.ts';

interface FixtureOverrides {
  missionLifecycleState?: string;
  missionApprovalState?: string;
  missionReadinessState?: string;
  assignmentDecisionState?: string;
  assignmentMode?: string;
  teamAvailabilityState?: string;
  teamReadinessState?: string;
  teamLifecycleState?: string;
  dagDependencyState?: 'COMPLETED' | 'READY' | 'INCOMPLETE' | 'BLOCKED' | 'INCONCLUSIVE';
}

function createEvaluator(overrides: FixtureOverrides = {}) {
  const missionProjection = {
    projectOne: (missionId: string) => ({
      missionId,
      missionType: 'generate-product-spec',
      deliverableSummary: {
        totalRequested: 2,
        satisfied: 0,
        pending: 2,
      },
      status: {
        lifecycleState: overrides.missionLifecycleState ?? 'draft',
        approvalState: overrides.missionApprovalState ?? 'approved',
        readinessState: overrides.missionReadinessState ?? 'ready',
      },
      instance: {
        createdFrom: { kind: 'founder_directive' },
      },
    }),
    projectAll: () => ([{ missionId: 'mission-1' }]),
  };

  const assignmentProjection = {
    projectOne: () => ({
      assignmentDecisionId: 'assignment-1',
      missionId: 'mission-1',
      selectedTeamId: 'team-a',
      activationPolicyId: 'single-best-candidate',
      assignmentPolicyId: 'single-best-candidate',
      decisionState: overrides.assignmentDecisionState ?? 'confirmed',
      assignmentMode: overrides.assignmentMode ?? 'policy_selected',
      candidateTeams: [{
        teamId: 'team-a',
        teamLifecycleState: overrides.teamLifecycleState ?? 'active',
        availabilityState: overrides.teamAvailabilityState ?? 'available',
      }],
    }),
    projectAll: () => ([{
      assignmentDecision: {
        missionId: 'mission-1',
        assignmentPolicyId: 'single-best-candidate',
      },
    }]),
  };

  const compatibilityProjection = {
    projectOne: () => ({
      manualReviewTeamCount: overrides.assignmentMode === 'manual_review_required' ? 1 : 0,
    }),
  };

  const teamProjection = {
    projectOne: () => ({
      status: {
        lifecycleState: overrides.teamLifecycleState ?? 'active',
        availabilityState: overrides.teamAvailabilityState ?? 'available',
        readinessState: overrides.teamReadinessState ?? 'ready',
      },
    }),
  };

  const dagProjection = {
    projectAll: () => (overrides.dagDependencyState ? [{
      nodeStates: [
        {
          missionId: 'mission-1',
          dependencyMissionIds: ['parent-1'],
        },
        {
          missionId: 'parent-1',
          state: overrides.dagDependencyState,
          dependencyMissionIds: [],
        },
      ],
    }] : []),
  };

  return createMissionActivationEvaluator({
    missionProjection: missionProjection as never,
    assignmentProjection: assignmentProjection as never,
    compatibilityProjection: compatibilityProjection as never,
    teamProjection: teamProjection as never,
    dagProjection: dagProjection as never,
  });
}

describe('mission activation evaluator', () => {
  it('T-MACT-E1 computes ready activation for confirmed assignment default policy', () => {
    const evaluator = createEvaluator();
    const result = evaluator.evaluateActivation({
      missionId: 'mission-1',
      activationPolicyId: 'confirmed-assignment-default',
    });

    expect(result.activationDecision.executionReadinessState).toBe('ready');
    expect(result.activationDecision.activationState).toBe('ready_for_activation');
  });

  it('T-MACT-E2 computes waiting_on_confirmation for strict founder policy', () => {
    const evaluator = createEvaluator();
    const result = evaluator.evaluateActivation({
      missionId: 'mission-1',
      activationPolicyId: 'strict-founder-gated-activation',
    });

    expect(result.activationDecision.executionReadinessState).toBe('waiting_on_confirmation');
    expect(result.activationDecision.activationState).toBe('under_review');
  });

  it('T-MACT-E3 computes blocked when team is unavailable', () => {
    const evaluator = createEvaluator({ teamAvailabilityState: 'unavailable' });
    const result = evaluator.evaluateActivation({
      missionId: 'mission-1',
      activationPolicyId: 'confirmed-assignment-default',
    });

    expect(result.activationDecision.executionReadinessState).toBe('blocked');
    expect(result.activationDecision.blockingReasons).toContain('team_unavailable');
  });

  it('T-MACT-E4 computes blocked when mission readiness is blocked', () => {
    const evaluator = createEvaluator({ missionReadinessState: 'blocked' });
    const result = evaluator.evaluateActivation({
      missionId: 'mission-1',
      activationPolicyId: 'confirmed-assignment-default',
    });

    expect(result.activationDecision.executionReadinessState).toBe('blocked');
    expect(result.activationDecision.blockingReasons).toContain('mission_readiness_blocked');
  });

  it('T-MACT-E5 computes blocked when DAG dependency is blocked', () => {
    const evaluator = createEvaluator({ dagDependencyState: 'BLOCKED' });
    const result = evaluator.evaluateActivation({
      missionId: 'mission-1',
      activationPolicyId: 'confirmed-assignment-default',
    });

    expect(result.activationDecision.executionReadinessState).toBe('blocked');
    expect(result.activationDecision.blockingReasons).toContain('dag_dependency_blocked');
  });

  it('T-MACT-E6 computes incomplete when mission readiness is incomplete', () => {
    const evaluator = createEvaluator({ missionReadinessState: 'incomplete' });
    const result = evaluator.evaluateActivation({
      missionId: 'mission-1',
      activationPolicyId: 'confirmed-assignment-default',
    });

    expect(result.activationDecision.executionReadinessState).toBe('incomplete');
  });

  it('T-MACT-E7 computes inconclusive when team readiness is inconclusive', () => {
    const evaluator = createEvaluator({ teamReadinessState: 'inconclusive' });
    const result = evaluator.evaluateActivation({
      missionId: 'mission-1',
      activationPolicyId: 'confirmed-assignment-default',
    });

    expect(result.activationDecision.executionReadinessState).toBe('inconclusive');
  });

  it('T-MACT-E8 repeated evaluation with identical inputs is deterministic', () => {
    const evaluator = createEvaluator();

    const first = evaluator.evaluateActivation({ missionId: 'mission-1' });
    const second = evaluator.evaluateActivation({ missionId: 'mission-1' });

    expect(first).toEqual(second);
    expect(first.activationDecision.activationDecisionId).toHaveLength(64);
  });
});
