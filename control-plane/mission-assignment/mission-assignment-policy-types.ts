export const MISSION_ASSIGNMENT_POLICY_SELECTION_MODES = [
  'single_best_candidate',
  'manual_review_first',
  'founder_confirmation_required',
] as const;

export type MissionAssignmentPolicySelectionMode = typeof MISSION_ASSIGNMENT_POLICY_SELECTION_MODES[number];

export interface MissionAssignmentPolicy {
  assignmentPolicyId: string;
  displayName: string;
  description: string;
  selectionMode: MissionAssignmentPolicySelectionMode;
  priorityRules: string[];
  manualReviewRules: string[];
  tieBreakerRules: string[];
  enabled: boolean;
}
