import type { MissionAssignmentPolicy } from './mission-assignment-policy-types.ts';

const SEEDED_POLICIES: MissionAssignmentPolicy[] = [
  {
    assignmentPolicyId: 'founder-confirmation-default',
    displayName: 'Founder Confirmation Default',
    description: 'Ranks candidates deterministically and requires founder confirmation before selection is confirmed.',
    selectionMode: 'founder_confirmation_required',
    priorityRules: [
      'compatibility_class',
      'assignment_readiness',
      'lifecycle_preference',
      'availability_preference',
    ],
    manualReviewRules: [
      'tie_among_top_candidates',
      'top_candidate_manual_only',
      'no_strong_match',
      'top_candidate_restricted',
      'founder_confirmation_required',
    ],
    tieBreakerRules: ['lexical_team_id'],
    enabled: true,
  },
  {
    assignmentPolicyId: 'manual-review-first',
    displayName: 'Manual Review First',
    description: 'Always routes assignment decisions to under-review state after deterministic ranking.',
    selectionMode: 'manual_review_first',
    priorityRules: [
      'compatibility_class',
      'assignment_readiness',
      'lifecycle_preference',
      'availability_preference',
    ],
    manualReviewRules: [
      'manual_review_first_policy',
      'tie_among_top_candidates',
      'no_strong_match',
    ],
    tieBreakerRules: ['lexical_team_id'],
    enabled: true,
  },
  {
    assignmentPolicyId: 'single-best-candidate',
    displayName: 'Single Best Candidate',
    description: 'Selects the highest-ranked deterministic candidate when manual review triggers are absent.',
    selectionMode: 'single_best_candidate',
    priorityRules: [
      'compatibility_class',
      'assignment_readiness',
      'lifecycle_preference',
      'availability_preference',
    ],
    manualReviewRules: [
      'tie_among_top_candidates',
      'top_candidate_manual_only',
      'no_strong_match',
      'top_candidate_restricted',
    ],
    tieBreakerRules: ['lexical_team_id'],
    enabled: true,
  },
];

export const DEFAULT_MISSION_ASSIGNMENT_POLICY_ID = 'founder-confirmation-default';

export function listMissionAssignmentPolicies(): MissionAssignmentPolicy[] {
  return [...SEEDED_POLICIES]
    .sort((left, right) => left.assignmentPolicyId.localeCompare(right.assignmentPolicyId));
}

export function getMissionAssignmentPolicy(assignmentPolicyId: string): MissionAssignmentPolicy {
  const policy = SEEDED_POLICIES.find((entry) => entry.assignmentPolicyId === assignmentPolicyId && entry.enabled);
  if (!policy) {
    throw new Error(`MISSION_ASSIGNMENT_POLICY_NOT_FOUND: ${assignmentPolicyId}`);
  }
  return policy;
}
