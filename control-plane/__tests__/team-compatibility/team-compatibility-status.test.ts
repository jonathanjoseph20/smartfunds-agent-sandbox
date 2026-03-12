import { describe, expect, it } from 'vitest';

import { deriveCompatibilitySetState, summarizeCompatibilityCounts } from '../../team-compatibility/team-compatibility-status.ts';
import type { MissionTeamCompatibilityCandidate } from '../../team-compatibility/team-compatibility-types.ts';

function candidate(overrides: Partial<MissionTeamCompatibilityCandidate>): MissionTeamCompatibilityCandidate {
  return {
    teamId: 'team-1',
    compatibilityClass: 'unsupported',
    assignmentReadiness: 'blocked',
    matchReasons: [],
    blockingReasons: [],
    limitations: [],
    supportedMissionType: false,
    supportedTemplateMatch: null,
    domainOverlap: [],
    capabilityOverlap: [],
    availabilityState: 'available',
    teamReadinessState: 'ready',
    teamLifecycleState: 'active',
    ...overrides,
  };
}

describe('team compatibility status', () => {
  it('T-TC-S1 derives ready when at least one ready candidate exists', () => {
    const state = deriveCompatibilitySetState({
      candidateTeams: [
        candidate({ teamId: 'a', compatibilityClass: 'unsupported', assignmentReadiness: 'blocked' }),
        candidate({ teamId: 'b', compatibilityClass: 'strong_match', assignmentReadiness: 'ready' }),
      ],
    });

    expect(state).toBe('ready');
  });

  it('T-TC-S2 derives partial when only manual or incomplete candidates exist', () => {
    const state = deriveCompatibilitySetState({
      candidateTeams: [
        candidate({ teamId: 'a', compatibilityClass: 'partial_match', assignmentReadiness: 'manual_review_required' }),
        candidate({ teamId: 'b', compatibilityClass: 'conditional_match', assignmentReadiness: 'incomplete' }),
      ],
    });

    expect(state).toBe('partial');
  });

  it('T-TC-S3 distinguishes blocked from unsupported', () => {
    const blocked = deriveCompatibilitySetState({
      candidateTeams: [
        candidate({ teamId: 'a', compatibilityClass: 'partial_match', assignmentReadiness: 'blocked' }),
        candidate({ teamId: 'b', compatibilityClass: 'conditional_match', assignmentReadiness: 'blocked' }),
      ],
    });

    const unsupported = deriveCompatibilitySetState({
      candidateTeams: [
        candidate({ teamId: 'a', compatibilityClass: 'unsupported', assignmentReadiness: 'blocked' }),
        candidate({ teamId: 'b', compatibilityClass: 'unsupported', assignmentReadiness: 'blocked' }),
      ],
    });

    expect(blocked).toBe('blocked');
    expect(unsupported).toBe('unsupported');
  });

  it('T-TC-S4 supports inconclusive set state', () => {
    const state = deriveCompatibilitySetState({
      candidateTeams: [
        candidate({ teamId: 'a', compatibilityClass: 'inconclusive', assignmentReadiness: 'inconclusive' }),
      ],
    });

    expect(state).toBe('inconclusive');
  });

  it('T-TC-S5 summarizes counts deterministically', () => {
    const counts = summarizeCompatibilityCounts({
      candidateTeams: [
        candidate({ teamId: 'a', compatibilityClass: 'strong_match', assignmentReadiness: 'ready' }),
        candidate({ teamId: 'b', compatibilityClass: 'conditional_match', assignmentReadiness: 'manual_review_required' }),
        candidate({ teamId: 'c', compatibilityClass: 'unsupported', assignmentReadiness: 'blocked' }),
      ],
    });

    expect(counts).toEqual({
      supportedTeamCount: 2,
      blockedTeamCount: 1,
      manualReviewTeamCount: 1,
      unsupportedTeamCount: 1,
    });
  });
});
