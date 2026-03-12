import { describe, expect, it } from 'vitest';

import { getMissionAssignmentPolicy } from '../../mission-assignment/mission-assignment-policies.ts';
import {
  deriveManualReviewTriggers,
  deriveMissionAssignmentStatus,
} from '../../mission-assignment/mission-assignment-status.ts';
import type { MissionAssignmentCandidate } from '../../mission-assignment/mission-assignment-types.ts';

function candidate(overrides: Partial<MissionAssignmentCandidate>): MissionAssignmentCandidate {
  return {
    teamId: 'team-1',
    compatibilityClass: 'strong_match',
    assignmentReadiness: 'ready',
    assignmentRank: 1,
    policyScoreClass: 'high',
    matchReasons: [],
    blockingReasons: [],
    limitations: [],
    teamLifecycleState: 'active',
    availabilityState: 'available',
    ...overrides,
  };
}

describe('mission assignment status', () => {
  it('T-MA-S1 flags manual review triggers for ties, manual-only, no-strong-match, restricted, founder confirmation', () => {
    const policy = getMissionAssignmentPolicy('founder-confirmation-default');
    const triggers = deriveManualReviewTriggers({
      policy,
      candidateTeams: [
        candidate({ teamId: 'a', compatibilityClass: 'partial_match', availabilityState: 'restricted' }),
        candidate({ teamId: 'b', compatibilityClass: 'partial_match', availabilityState: 'restricted' }),
      ],
      topRankedCandidates: [
        candidate({ teamId: 'a', compatibilityClass: 'partial_match', availabilityState: 'restricted' }),
        candidate({ teamId: 'b', compatibilityClass: 'partial_match', availabilityState: 'restricted' }),
      ],
      hasTopTie: true,
    });

    expect(triggers).toContain('tie_among_top_candidates');
    expect(triggers).toContain('top_candidate_restricted');
    expect(triggers).toContain('no_strong_match');
    expect(triggers).toContain('founder_confirmation_required');
  });

  it('T-MA-S2 derives recommended state when no manual review triggers exist', () => {
    const policy = getMissionAssignmentPolicy('single-best-candidate');

    const status = deriveMissionAssignmentStatus({
      policy,
      candidateTeams: [candidate({ teamId: 'team-a' })],
      selectedTeamId: 'team-a',
      manualReviewTriggers: [],
      founderOverrideApplied: false,
    });

    expect(status.decisionState).toBe('recommended');
    expect(status.assignmentMode).toBe('policy_selected');
  });

  it('T-MA-S3 derives under_review for manual review trigger path', () => {
    const policy = getMissionAssignmentPolicy('single-best-candidate');

    const status = deriveMissionAssignmentStatus({
      policy,
      candidateTeams: [candidate({ teamId: 'team-a', availabilityState: 'manual_only' })],
      selectedTeamId: 'team-a',
      manualReviewTriggers: ['top_candidate_manual_only'],
      founderOverrideApplied: false,
    });

    expect(status.decisionState).toBe('under_review');
    expect(status.assignmentMode).toBe('manual_review_required');
  });

  it('T-MA-S4 derives confirmed state from history event', () => {
    const policy = getMissionAssignmentPolicy('founder-confirmation-default');

    const status = deriveMissionAssignmentStatus({
      policy,
      candidateTeams: [candidate({ teamId: 'team-a' })],
      selectedTeamId: 'team-a',
      manualReviewTriggers: [],
      founderOverrideApplied: false,
      historyEntries: [{
        assignmentDecisionId: 'd1',
        missionId: 'm1',
        eventType: 'assignment_confirmed',
        eventDedupeKey: 'k1',
        reasoning: 'confirmed',
        payload: {},
      }],
    });

    expect(status.decisionState).toBe('confirmed');
    expect(status.assignmentMode).toBe('founder_selected');
  });

  it('T-MA-S5 derives rejected state from history event', () => {
    const policy = getMissionAssignmentPolicy('single-best-candidate');

    const status = deriveMissionAssignmentStatus({
      policy,
      candidateTeams: [candidate({ teamId: 'team-a' })],
      selectedTeamId: 'team-a',
      manualReviewTriggers: [],
      founderOverrideApplied: false,
      historyEntries: [{
        assignmentDecisionId: 'd1',
        missionId: 'm1',
        eventType: 'assignment_rejected',
        eventDedupeKey: 'k1',
        reasoning: 'rejected',
        payload: {},
      }],
    });

    expect(status.decisionState).toBe('rejected');
  });
});
