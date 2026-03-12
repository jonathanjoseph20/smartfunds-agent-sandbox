import type { MissionAssignmentPolicy } from './mission-assignment-policy-types.ts';
import type {
  MissionAssignmentCandidate,
  MissionAssignmentDecisionState,
  MissionAssignmentHistoryEntry,
  MissionAssignmentMode,
} from './mission-assignment-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasHistoryEvent(entries: MissionAssignmentHistoryEntry[] | undefined, eventType: string): boolean {
  if (!entries) {
    return false;
  }
  return entries.some((entry) => entry.eventType === eventType);
}

export function deriveManualReviewTriggers(input: {
  policy: MissionAssignmentPolicy;
  candidateTeams: MissionAssignmentCandidate[];
  topRankedCandidates: MissionAssignmentCandidate[];
  hasTopTie: boolean;
}): string[] {
  const triggers: string[] = [];

  if (input.hasTopTie) {
    triggers.push('tie_among_top_candidates');
  }

  const topCandidate = input.topRankedCandidates[0];
  if (topCandidate?.availabilityState === 'manual_only') {
    triggers.push('top_candidate_manual_only');
  }

  if (topCandidate?.availabilityState === 'restricted') {
    triggers.push('top_candidate_restricted');
  }

  const hasStrongMatch = input.candidateTeams.some((entry) => entry.compatibilityClass === 'strong_match');
  if (!hasStrongMatch) {
    triggers.push('no_strong_match');
  }

  if (input.policy.selectionMode === 'manual_review_first') {
    triggers.push('manual_review_first_policy');
  }

  if (input.policy.selectionMode === 'founder_confirmation_required') {
    triggers.push('founder_confirmation_required');
  }

  return uniqueSorted(triggers);
}

export function deriveMissionAssignmentStatus(input: {
  policy: MissionAssignmentPolicy;
  candidateTeams: MissionAssignmentCandidate[];
  selectedTeamId?: string;
  manualReviewTriggers: string[];
  founderOverrideApplied: boolean;
  historyEntries?: MissionAssignmentHistoryEntry[];
}): {
  decisionState: MissionAssignmentDecisionState;
  assignmentMode: MissionAssignmentMode;
  decisionReason: string;
} {
  if (hasHistoryEvent(input.historyEntries, 'assignment_rejected')) {
    return {
      decisionState: 'rejected',
      assignmentMode: input.selectedTeamId ? 'policy_selected' : 'no_selection',
      decisionReason: 'assignment_rejected_by_history',
    };
  }

  if (input.founderOverrideApplied) {
    return {
      decisionState: 'confirmed',
      assignmentMode: 'founder_override',
      decisionReason: 'founder_override_applied',
    };
  }

  if (hasHistoryEvent(input.historyEntries, 'assignment_confirmed')) {
    return {
      decisionState: 'confirmed',
      assignmentMode: input.policy.selectionMode === 'founder_confirmation_required'
        ? 'founder_selected'
        : 'policy_selected',
      decisionReason: 'assignment_confirmed_by_history',
    };
  }

  if (input.candidateTeams.length === 0 || !input.selectedTeamId) {
    return {
      decisionState: 'blocked',
      assignmentMode: 'no_selection',
      decisionReason: input.candidateTeams.length === 0
        ? 'no_compatible_candidates'
        : 'no_selectable_candidates',
    };
  }

  if (input.manualReviewTriggers.length > 0) {
    return {
      decisionState: 'under_review',
      assignmentMode: 'manual_review_required',
      decisionReason: `manual_review_required:${input.manualReviewTriggers[0]}`,
    };
  }

  return {
    decisionState: 'recommended',
    assignmentMode: 'policy_selected',
    decisionReason: 'policy_selected_best_candidate',
  };
}
