import type { TeamAvailabilityState, TeamLifecycleState, TeamReadinessState } from '../teams/team-types.ts';

export const COMPATIBILITY_CLASSES = [
  'strong_match',
  'partial_match',
  'conditional_match',
  'unsupported',
  'inconclusive',
] as const;

export const ASSIGNMENT_READINESS_STATES = [
  'ready',
  'manual_review_required',
  'blocked',
  'incomplete',
  'inconclusive',
] as const;

export const COMPATIBILITY_SET_STATES = [
  'ready',
  'partial',
  'blocked',
  'unsupported',
  'inconclusive',
] as const;

export const TEAM_COMPATIBILITY_HISTORY_EVENT_TYPES = [
  'compatibility_evaluated',
  'candidate_added',
  'candidate_removed',
  'candidate_state_changed',
  'compatibility_materialized',
] as const;

export type CompatibilityClass = typeof COMPATIBILITY_CLASSES[number];
export type AssignmentReadiness = typeof ASSIGNMENT_READINESS_STATES[number];
export type CompatibilitySetState = typeof COMPATIBILITY_SET_STATES[number];
export type TeamCompatibilityHistoryEventType = typeof TEAM_COMPATIBILITY_HISTORY_EVENT_TYPES[number];

export interface MissionTeamCompatibilityCandidate {
  teamId: string;
  compatibilityClass: CompatibilityClass;
  assignmentReadiness: AssignmentReadiness;
  matchReasons: string[];
  blockingReasons: string[];
  limitations: string[];
  supportedMissionType: boolean;
  supportedTemplateMatch: boolean | null;
  domainOverlap: string[];
  capabilityOverlap: string[];
  availabilityState: TeamAvailabilityState;
  teamReadinessState: TeamReadinessState;
  teamLifecycleState: TeamLifecycleState;
}

export interface MissionTeamCompatibilitySet {
  compatibilitySetId: string;
  missionId: string;
  missionType: string;
  templateId?: string;
  compatibilityState: CompatibilitySetState;
  candidateTeams: MissionTeamCompatibilityCandidate[];
  supportedTeamCount: number;
  blockedTeamCount: number;
  manualReviewTeamCount: number;
  unsupportedTeamCount: number;
  limitations: string[];
  historyDigest: string;
}

export interface MissionCompatibilityStatusSummary {
  compatibilitySetId: string;
  missionId: string;
  compatibilityState: CompatibilitySetState;
  supportedTeamCount: number;
  blockedTeamCount: number;
  manualReviewTeamCount: number;
  unsupportedTeamCount: number;
}

export interface TeamCompatibilityHistoryEntry {
  compatibilitySetId: string;
  missionId: string;
  eventType: TeamCompatibilityHistoryEventType;
  eventDedupeKey: string;
  reasoning: string;
  payload: Record<string, unknown>;
}

export interface TeamCompatibilityHistory {
  compatibilitySetId: string;
  missionId: string;
  entries: TeamCompatibilityHistoryEntry[];
}

export interface TeamCompatibilityProjection {
  compatibilitySetId: string;
  missionId: string;
  missionType: string;
  templateId?: string;
  compatibilityState: CompatibilitySetState;
  candidateTeams: MissionTeamCompatibilityCandidate[];
  supportedTeamCount: number;
  blockedTeamCount: number;
  manualReviewTeamCount: number;
  unsupportedTeamCount: number;
  limitations: string[];
  historyDigest: string;
  historySummary: {
    totalEvents: number;
    lastEventType?: TeamCompatibilityHistoryEventType;
    lastEventDedupeKey?: string;
  };
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    historyJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
  };
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}

export interface TeamCompatibilityMaterializationSummary {
  compatibilitySetId: string;
  missionId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
}

export interface TeamCompatibilityEvaluationResult {
  compatibilitySet: MissionTeamCompatibilitySet;
  compatibilityState: CompatibilitySetState;
}
