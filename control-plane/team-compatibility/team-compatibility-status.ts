import type {
  CompatibilitySetState,
  MissionTeamCompatibilityCandidate,
} from './team-compatibility-types.ts';

export function deriveCompatibilitySetState(input: {
  candidateTeams: MissionTeamCompatibilityCandidate[];
}): CompatibilitySetState {
  const candidates = input.candidateTeams;

  if (candidates.length === 0) {
    return 'unsupported';
  }

  if (candidates.some((entry) => entry.assignmentReadiness === 'ready')) {
    return 'ready';
  }

  const hasManualReview = candidates.some((entry) => entry.assignmentReadiness === 'manual_review_required');
  const hasIncomplete = candidates.some((entry) => entry.assignmentReadiness === 'incomplete');
  if (hasManualReview || hasIncomplete) {
    return 'partial';
  }

  const hasInconclusive = candidates.some((entry) => entry.assignmentReadiness === 'inconclusive');
  const allBlocked = candidates.every((entry) => entry.assignmentReadiness === 'blocked');
  const allUnsupported = candidates.every((entry) => entry.compatibilityClass === 'unsupported');

  if (allUnsupported) {
    return 'unsupported';
  }

  if (allBlocked) {
    return 'blocked';
  }

  if (hasInconclusive) {
    return 'inconclusive';
  }

  return 'unsupported';
}

export function summarizeCompatibilityCounts(input: {
  candidateTeams: MissionTeamCompatibilityCandidate[];
}): {
  supportedTeamCount: number;
  blockedTeamCount: number;
  manualReviewTeamCount: number;
  unsupportedTeamCount: number;
} {
  const supportedTeamCount = input.candidateTeams
    .filter((entry) => entry.compatibilityClass !== 'unsupported')
    .length;

  const blockedTeamCount = input.candidateTeams
    .filter((entry) => entry.assignmentReadiness === 'blocked')
    .length;

  const manualReviewTeamCount = input.candidateTeams
    .filter((entry) => entry.assignmentReadiness === 'manual_review_required')
    .length;

  const unsupportedTeamCount = input.candidateTeams
    .filter((entry) => entry.compatibilityClass === 'unsupported')
    .length;

  return {
    supportedTeamCount,
    blockedTeamCount,
    manualReviewTeamCount,
    unsupportedTeamCount,
  };
}
