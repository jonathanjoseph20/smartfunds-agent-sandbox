import { canonicalStringify, sha256 } from '../finance/determinism.ts';

export const MISSION_LIFECYCLE_STATES = [
  'created',
  'ready',
  'active',
  'paused',
  'resuming',
  'blocked',
  'cancelled',
  'completed',
  'failed',
  'archived',
] as const;

export const MISSION_INTERVENTION_TYPES = [
  'pause',
  'resume',
  'cancel',
  'reprioritize',
  'acknowledge_escalation',
  'defer',
  'force_review',
] as const;

export const MISSION_INTERVENTION_STATES = [
  'recorded',
  'acknowledged',
  'superseded',
] as const;

export const MISSION_RELATIONSHIP_TYPES = [
  'depends_on',
  'blocks',
  'follows',
  'requires_review_from',
  'related_to',
] as const;

export const MISSION_RELATIONSHIP_STATES = [
  'active',
  'unblocked',
] as const;

export const MISSION_PRIORITY_LEVELS = [
  'critical',
  'high',
  'normal',
  'low',
  'deferred',
] as const;

export const MISSION_COORDINATION_STATES = [
  'awaiting_start',
  'active',
  'paused_by_operator',
  'blocked_by_dependency',
  'blocked_by_escalation',
  'cancelled_by_operator',
  'ready_to_resume',
  'completed',
  'failed',
  'inconclusive',
] as const;

export const MISSION_COORDINATION_HISTORY_EVENT_TYPES = [
  'mission_lifecycle_transitioned',
  'mission_intervention_recorded',
  'mission_priority_updated',
  'mission_dependency_linked',
  'mission_dependency_unblocked',
  'mission_paused',
  'mission_resumed',
  'mission_cancelled',
  'mission_coordination_blocked',
  'mission_coordination_unblocked',
] as const;

export type MissionLifecycleState = typeof MISSION_LIFECYCLE_STATES[number];
export type MissionInterventionType = typeof MISSION_INTERVENTION_TYPES[number];
export type MissionInterventionState = typeof MISSION_INTERVENTION_STATES[number];
export type MissionRelationshipType = typeof MISSION_RELATIONSHIP_TYPES[number];
export type MissionRelationshipState = typeof MISSION_RELATIONSHIP_STATES[number];
export type MissionPriorityLevel = typeof MISSION_PRIORITY_LEVELS[number];
export type MissionCoordinationState = typeof MISSION_COORDINATION_STATES[number];
export type MissionCoordinationHistoryEventType = typeof MISSION_COORDINATION_HISTORY_EVENT_TYPES[number];

export interface MissionLifecycleTransition {
  missionLifecycleTransitionId: string;
  missionRunId: string;
  fromState: MissionLifecycleState;
  toState: MissionLifecycleState;
  reasonTokens: string[];
  linkedEscalationIds: string[];
  linkedInterventionId: string | null;
}

export interface MissionIntervention {
  missionInterventionId: string;
  missionRunId: string;
  interventionType: MissionInterventionType;
  requestedBy: string;
  reasonTokens: string[];
  targetLifecycleState: MissionLifecycleState | null;
  linkedEscalationIds: string[];
  state: MissionInterventionState;
}

export interface MissionRelationship {
  missionRelationshipId: string;
  sourceMissionRunId: string;
  targetMissionRunId: string;
  relationshipType: MissionRelationshipType;
  blockingReasonTokens: string[];
  state: MissionRelationshipState;
}

export interface MissionPrioritySignal {
  missionRunId: string;
  priority: MissionPriorityLevel;
  reasonTokens: string[];
}

export interface MissionCoordinationHistoryEntry {
  missionRunId: string;
  eventType: MissionCoordinationHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface MissionCoordinationHistory {
  missionRunId: string;
  entries: MissionCoordinationHistoryEntry[];
}

export interface MissionDependencySummary {
  missionRelationshipId: string;
  sourceMissionRunId: string;
  targetMissionRunId: string;
  relationshipType: MissionRelationshipType;
  blockingReasonTokens: string[];
  state: MissionRelationshipState;
}

export interface MissionCoordinationProjection {
  missionRunId: string;
  lifecycleState: MissionLifecycleState;
  coordinationState: MissionCoordinationState;
  priority: MissionPriorityLevel;
  activeInterventions: MissionIntervention[];
  dependencySummaries: MissionDependencySummary[];
  blockingMissionRunIds: string[];
  blockedByEscalations: string[];
  resumeEligibility: 'eligible' | 'ineligible';
  lastLifecycleTransitionId: string | null;
  lastInterventionId: string | null;
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function normalizeReasonTokens(reasonTokens: string[] | undefined): string[] {
  return uniqueSorted((reasonTokens ?? []).map((token) => token.trim()).filter((token) => token.length > 0));
}

export function normalizeLinkedEscalationIds(ids: string[] | undefined): string[] {
  return uniqueSorted((ids ?? []).map((value) => value.trim()).filter((value) => value.length > 0));
}

export function computeMissionCoordinationSemanticId(payload: Record<string, unknown>): string {
  return sha256(canonicalStringify(payload));
}

export interface InvalidLifecycleTransitionErrorPayload {
  error: 'invalid_lifecycle_transition';
  fromState: MissionLifecycleState;
  toState: MissionLifecycleState;
  missionRunId: string;
}
