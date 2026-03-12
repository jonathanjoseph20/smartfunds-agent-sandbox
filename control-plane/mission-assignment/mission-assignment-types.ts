import type { MissionCreatedFrom } from '../missions/mission-instance-types.ts';

export const MISSION_ASSIGNMENT_MODES = [
  'policy_selected',
  'founder_selected',
  'founder_override',
  'manual_review_required',
  'no_selection',
] as const;

export const MISSION_ASSIGNMENT_DECISION_STATES = [
  'draft',
  'recommended',
  'under_review',
  'confirmed',
  'blocked',
  'rejected',
  'archived',
] as const;

export const MISSION_ASSIGNMENT_HISTORY_EVENT_TYPES = [
  'assignment_evaluated',
  'assignment_recommended',
  'assignment_confirmed',
  'assignment_rejected',
  'assignment_overridden',
  'assignment_materialized',
] as const;

export const ASSIGNMENT_POLICY_SCORE_CLASSES = [
  'high',
  'medium',
  'low',
  'none',
  'inconclusive',
] as const;

export type MissionAssignmentMode = typeof MISSION_ASSIGNMENT_MODES[number];
export type MissionAssignmentDecisionState = typeof MISSION_ASSIGNMENT_DECISION_STATES[number];
export type MissionAssignmentHistoryEventType = typeof MISSION_ASSIGNMENT_HISTORY_EVENT_TYPES[number];
export type AssignmentPolicyScoreClass = typeof ASSIGNMENT_POLICY_SCORE_CLASSES[number];

export interface MissionAssignmentFounderOverride {
  applied: boolean;
  selectedTeamId?: string;
  reason?: string;
  reviewedBy?: string;
}

export interface MissionAssignmentCandidate {
  teamId: string;
  compatibilityClass: 'strong_match' | 'partial_match' | 'conditional_match' | 'unsupported' | 'inconclusive';
  assignmentReadiness: 'ready' | 'manual_review_required' | 'incomplete' | 'blocked' | 'inconclusive';
  assignmentRank: number;
  policyScoreClass: AssignmentPolicyScoreClass;
  matchReasons: string[];
  blockingReasons: string[];
  limitations: string[];
  teamLifecycleState: 'active' | 'defined' | 'dormant' | 'archived';
  availabilityState: 'available' | 'restricted' | 'manual_only' | 'unavailable';
}

export interface MissionAssignmentDecision {
  assignmentDecisionId: string;
  missionId: string;
  compatibilitySetId: string;
  selectedTeamId?: string;
  assignmentPolicyId: string;
  assignmentMode: MissionAssignmentMode;
  decisionState: MissionAssignmentDecisionState;
  decisionReason: string;
  matchReasons: string[];
  blockingReasons: string[];
  limitations: string[];
  candidateTeams: MissionAssignmentCandidate[];
  alternativeTeams: string[];
  founderOverride: MissionAssignmentFounderOverride;
  createdFrom: MissionCreatedFrom;
  historyDigest: string;
}

export interface MissionAssignmentHistoryEntry {
  assignmentDecisionId: string;
  missionId: string;
  eventType: MissionAssignmentHistoryEventType;
  eventDedupeKey: string;
  reasoning: string;
  payload: Record<string, unknown>;
}

export interface MissionAssignmentHistory {
  assignmentDecisionId: string;
  missionId: string;
  entries: MissionAssignmentHistoryEntry[];
}

export interface MissionAssignmentMissionResolutionEntry {
  missionId: string;
  assignmentDecisionId: string;
  assignmentPolicyId: string;
  selectedTeamId?: string;
  founderOverride: MissionAssignmentFounderOverride;
  resolutionType: 'evaluated' | 'confirmed' | 'overridden' | 'materialized';
  resolutionDedupeKey: string;
  reasoning: string;
}

export interface MissionAssignmentMissionResolution {
  missionId: string;
  entries: MissionAssignmentMissionResolutionEntry[];
}

export interface MissionAssignmentProjection {
  assignmentDecisionId: string;
  missionId: string;
  compatibilitySetId: string;
  selectedTeamId?: string;
  assignmentPolicyId: string;
  assignmentMode: MissionAssignmentMode;
  decisionState: MissionAssignmentDecisionState;
  decisionReason: string;
  candidateTeams: MissionAssignmentCandidate[];
  alternativeTeams: string[];
  founderOverride: MissionAssignmentFounderOverride;
  matchReasons: string[];
  blockingReasons: string[];
  limitations: string[];
  historyDigest: string;
  historySummary: {
    totalEvents: number;
    lastEventType?: MissionAssignmentHistoryEventType;
    lastEventDedupeKey?: string;
  };
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    historyJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
    candidatesJsonPath: string;
  };
}

export interface MissionAssignmentMaterializationSummary {
  assignmentDecisionId: string;
  missionId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  candidatesPath: string;
}
