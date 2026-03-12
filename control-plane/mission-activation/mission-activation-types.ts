import type { MissionCreatedFrom } from '../missions/mission-instance-types.ts';

export const ACTIVATION_MODES = [
  'policy_evaluated',
  'founder_review_required',
  'founder_confirmed',
  'manual_gate',
  'no_activation',
] as const;

export const ACTIVATION_STATES = [
  'draft',
  'evaluated',
  'ready_for_activation',
  'under_review',
  'blocked',
  'rejected',
  'archived',
] as const;

export const EXECUTION_READINESS_STATES = [
  'ready',
  'waiting_on_dependencies',
  'waiting_on_confirmation',
  'blocked',
  'incomplete',
  'inconclusive',
] as const;

export const ACTIVATION_PRECONDITION_STATES = [
  'satisfied',
  'waiting',
  'blocked',
  'incomplete',
  'inconclusive',
] as const;

export const ACTIVATION_PRECONDITION_CATEGORIES = [
  'mission_state',
  'mission_readiness',
  'dag_dependencies',
  'assignment_state',
  'assignment_confirmation',
  'team_lifecycle',
  'team_availability',
  'team_readiness',
  'activation_confirmation',
] as const;

export const MISSION_ACTIVATION_HISTORY_EVENT_TYPES = [
  'activation_evaluated',
  'activation_ready',
  'activation_blocked',
  'activation_confirmed',
  'activation_rejected',
  'activation_materialized',
] as const;

export type ActivationMode = typeof ACTIVATION_MODES[number];
export type ActivationState = typeof ACTIVATION_STATES[number];
export type ExecutionReadinessState = typeof EXECUTION_READINESS_STATES[number];
export type ActivationPreconditionState = typeof ACTIVATION_PRECONDITION_STATES[number];
export type ActivationPreconditionCategory = typeof ACTIVATION_PRECONDITION_CATEGORIES[number];
export type MissionActivationHistoryEventType = typeof MISSION_ACTIVATION_HISTORY_EVENT_TYPES[number];

export interface ActivationPreconditionResult {
  preconditionId: string;
  category: ActivationPreconditionCategory;
  state: ActivationPreconditionState;
  reasonTokens: string[];
  blockingReasons: string[];
  limitations: string[];
}

export interface ExecutionHandoffContract {
  missionId: string;
  selectedTeamId: string;
  assignmentDecisionId: string;
  activationDecisionId: string;
  missionType: string;
  deliverableSummary: {
    totalRequested: number;
    satisfied: number;
    pending: number;
  };
  executionPreconditionsSatisfied: boolean;
  remainingBlockers: string[];
  runtimeInvocationSupported: boolean;
}

export interface MissionActivationDecision {
  activationDecisionId: string;
  missionId: string;
  assignmentDecisionId: string;
  selectedTeamId: string;
  activationPolicyId: string;
  activationMode: ActivationMode;
  activationState: ActivationState;
  executionReadinessState: ExecutionReadinessState;
  preconditionResults: ActivationPreconditionResult[];
  blockingReasons: string[];
  limitations: string[];
  activationReasonTokens: string[];
  handoffContract: ExecutionHandoffContract;
  createdFrom: MissionCreatedFrom;
  historyDigest: string;
}

export interface MissionActivationHistoryEntry {
  activationDecisionId: string;
  missionId: string;
  eventType: MissionActivationHistoryEventType;
  eventDedupeKey: string;
  reasoning: string;
  payload: Record<string, unknown>;
}

export interface MissionActivationHistory {
  activationDecisionId: string;
  missionId: string;
  entries: MissionActivationHistoryEntry[];
}

export interface MissionActivationProjection {
  activationDecisionId: string;
  missionId: string;
  assignmentDecisionId: string;
  selectedTeamId: string;
  activationPolicyId: string;
  activationMode: ActivationMode;
  activationState: ActivationState;
  executionReadinessState: ExecutionReadinessState;
  preconditionResults: ActivationPreconditionResult[];
  blockingReasons: string[];
  limitations: string[];
  activationReasonTokens: string[];
  handoffContract: ExecutionHandoffContract;
  createdFrom: MissionCreatedFrom;
  historyDigest: string;
  historySummary: {
    totalEvents: number;
    lastEventType?: MissionActivationHistoryEventType;
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
    preconditionsJsonPath: string;
    handoffJsonPath: string;
  };
}

export interface MissionActivationMaterializationSummary {
  activationDecisionId: string;
  missionId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  preconditionsPath: string;
  handoffPath: string;
}
