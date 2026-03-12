import { describe, expect, it } from 'vitest';

import { createMissionAssignmentEvaluator } from '../../mission-assignment/mission-assignment-evaluator.ts';

function createEvaluator() {
  const missionProjection = {
    projectOne: (missionId: string) => ({
      missionId,
      instance: {
        createdFrom: { kind: 'founder_directive' },
      },
    }),
    projectAll: () => ([{ missionId: 'mission-1' }]),
  };

  const compatibilityProjection = {
    projectOne: () => ({
      compatibilitySetId: 'compat-set-1',
      missionId: 'mission-1',
      limitations: [],
      candidateTeams: [
        {
          teamId: 'team-a',
          compatibilityClass: 'strong_match',
          assignmentReadiness: 'ready',
          matchReasons: ['supported_mission_type:generate-product-spec'],
          blockingReasons: [],
          limitations: [],
          teamLifecycleState: 'active',
          availabilityState: 'available',
        },
        {
          teamId: 'team-b',
          compatibilityClass: 'strong_match',
          assignmentReadiness: 'ready',
          matchReasons: ['supported_mission_type:generate-product-spec'],
          blockingReasons: [],
          limitations: [],
          teamLifecycleState: 'active',
          availabilityState: 'available',
        },
        {
          teamId: 'team-c',
          compatibilityClass: 'partial_match',
          assignmentReadiness: 'manual_review_required',
          matchReasons: ['supported_mission_type:generate-product-spec'],
          blockingReasons: [],
          limitations: ['availability_manual_only'],
          teamLifecycleState: 'active',
          availabilityState: 'manual_only',
        },
      ],
    }),
  };

  return createMissionAssignmentEvaluator({
    missionProjection: missionProjection as never,
    compatibilityProjection: compatibilityProjection as never,
  });
}

describe('mission assignment evaluator', () => {
  it('T-MA-E1 ranks candidates deterministically and computes alternatives', () => {
    const evaluator = createEvaluator();
    const result = evaluator.evaluateMissionAssignment({
      missionId: 'mission-1',
      assignmentPolicyId: 'single-best-candidate',
    });

    expect(result.candidateTeams.map((entry) => entry.teamId)).toEqual(['team-a', 'team-b', 'team-c']);
    expect(result.recommendedTeamId).toBe('team-a');
    expect(result.alternativeTeams).toEqual(['team-b', 'team-c']);
    expect(result.assignmentDecision.assignmentDecisionId).toHaveLength(64);
  });

  it('T-MA-E2 tie + founder confirmation trigger manual review state', () => {
    const evaluator = createEvaluator();
    const result = evaluator.evaluateMissionAssignment({
      missionId: 'mission-1',
      assignmentPolicyId: 'founder-confirmation-default',
    });

    expect(result.manualReviewRequired).toBe(true);
    expect(result.decisionState).toBe('under_review');
    expect(result.assignmentMode).toBe('manual_review_required');
    expect(result.blockingReasons).toContain('tie_among_top_candidates');
    expect(result.blockingReasons).toContain('founder_confirmation_required');
  });

  it('T-MA-E3 founder override selects candidate deterministically and produces new decision id', () => {
    const evaluator = createEvaluator();

    const baseline = evaluator.evaluateMissionAssignment({
      missionId: 'mission-1',
      assignmentPolicyId: 'single-best-candidate',
    });

    const overridden = evaluator.evaluateMissionAssignment({
      missionId: 'mission-1',
      assignmentPolicyId: 'single-best-candidate',
      founderOverride: {
        applied: true,
        selectedTeamId: 'team-c',
        reason: 'founder preference',
        reviewedBy: 'founder',
      },
    });

    expect(overridden.assignmentDecision.selectedTeamId).toBe('team-c');
    expect(overridden.assignmentDecision.assignmentMode).toBe('founder_override');
    expect(overridden.assignmentDecision.decisionState).toBe('confirmed');
    expect(overridden.assignmentDecision.assignmentDecisionId).not.toBe(baseline.assignmentDecision.assignmentDecisionId);
  });

  it('T-MA-E4 repeated evaluation is deterministic', () => {
    const evaluator = createEvaluator();

    const first = evaluator.evaluateMissionAssignment({
      missionId: 'mission-1',
      assignmentPolicyId: 'single-best-candidate',
    });
    const second = evaluator.evaluateMissionAssignment({
      missionId: 'mission-1',
      assignmentPolicyId: 'single-best-candidate',
    });

    expect(first).toEqual(second);
  });

  it('T-MA-E5 override rejects non-candidate teams', () => {
    const evaluator = createEvaluator();

    expect(() => evaluator.evaluateMissionAssignment({
      missionId: 'mission-1',
      founderOverride: {
        applied: true,
        selectedTeamId: 'team-x',
        reason: 'invalid',
      },
    })).toThrow('MISSION_ASSIGNMENT_OVERRIDE_TEAM_NOT_CANDIDATE: team-x');
  });
});
