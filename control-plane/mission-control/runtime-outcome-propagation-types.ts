import type { RuntimeOutcomePropagationOutcome } from './runtime-outcome-propagation-outcome.ts';
import type { RuntimeOutcomePropagationStatus } from './runtime-outcome-propagation-status.ts';

export const RUNTIME_OUTCOME_PROPAGATION_CLASSES = [
  'runtime_pending',
  'runtime_active',
  'runtime_completed',
  'runtime_failed',
  'runtime_deferred',
  'runtime_inconclusive',
] as const;

export const RUNTIME_OUTCOME_PROPAGATION_TARGET_LAYERS = [
  'activation_layer',
  'execution_coordination_layer',
  'mission_orchestration_layer',
  'mission_portfolio_layer',
] as const;

export const RUNTIME_OUTCOME_PROPAGATION_RECORD_STATES = [
  'active',
  'resolved',
  'inconclusive',
] as const;

export const ACTIVATION_LIFECYCLE_PROPAGATION_CLASSES = [
  'activation_completed',
  'activation_failed',
  'activation_deferred',
  'activation_retrying',
  'activation_inconclusive',
] as const;

export const EXECUTION_COORDINATION_PROPAGATION_CLASSES = [
  'coordination_completed',
  'coordination_partially_completed',
  'coordination_failed',
  'coordination_deferred',
  'coordination_inconclusive',
] as const;

export const MISSION_ORCHESTRATION_PROPAGATION_CLASSES = [
  'orchestration_action_completed',
  'orchestration_action_failed',
  'orchestration_plan_partially_completed',
  'orchestration_plan_completed',
  'orchestration_plan_blocked',
  'orchestration_inconclusive',
] as const;

export const MISSION_PORTFOLIO_STATE_PROPAGATION_CLASSES = [
  'portfolio_attention_cleared',
  'portfolio_resolution_advanced',
  'portfolio_resolution_blocked',
  'portfolio_stabilization_improved',
  'portfolio_stabilization_regressed',
  'portfolio_closure_eligibility_changed',
] as const;

export const RUNTIME_OUTCOME_PROPAGATION_HISTORY_EVENT_TYPES = [
  'runtime_outcome_propagation_record_created',
  'activation_lifecycle_propagated',
  'execution_coordination_propagated',
  'mission_orchestration_propagated',
  'mission_portfolio_state_propagated',
  'runtime_outcome_propagation_deferred',
  'runtime_outcome_propagation_failed',
  'runtime_outcome_propagation_materialized',
] as const;

export type RuntimeOutcomePropagationClass = typeof RUNTIME_OUTCOME_PROPAGATION_CLASSES[number];
export type RuntimeOutcomePropagationTargetLayer = typeof RUNTIME_OUTCOME_PROPAGATION_TARGET_LAYERS[number];
export type RuntimeOutcomePropagationRecordState = typeof RUNTIME_OUTCOME_PROPAGATION_RECORD_STATES[number];
export type ActivationLifecyclePropagationClass = typeof ACTIVATION_LIFECYCLE_PROPAGATION_CLASSES[number];
export type ExecutionCoordinationPropagationClass = typeof EXECUTION_COORDINATION_PROPAGATION_CLASSES[number];
export type MissionOrchestrationPropagationClass = typeof MISSION_ORCHESTRATION_PROPAGATION_CLASSES[number];
export type MissionPortfolioStatePropagationClass = typeof MISSION_PORTFOLIO_STATE_PROPAGATION_CLASSES[number];
export type RuntimeOutcomePropagationHistoryEventType = typeof RUNTIME_OUTCOME_PROPAGATION_HISTORY_EVENT_TYPES[number];

export interface RuntimeOutcomePropagationRecord {
  runtimeOutcomePropagationRecordId: string;
  activationDispatchAttemptId: string;
  executionActivationRecordId: string;
  executionRequestRecordId: string;
  propagationClass: RuntimeOutcomePropagationClass;
  targetLayer: RuntimeOutcomePropagationTargetLayer;
  state: RuntimeOutcomePropagationRecordState;
  outcome: RuntimeOutcomePropagationOutcome;
}

export interface ActivationLifecyclePropagation {
  activationLifecyclePropagationId: string;
  runtimeOutcomePropagationRecordId: string;
  executionActivationRecordId: string;
  propagationClass: ActivationLifecyclePropagationClass;
  reasonTokens: string[];
  state: RuntimeOutcomePropagationRecordState;
}

export interface ExecutionCoordinationPropagation {
  executionCoordinationPropagationId: string;
  runtimeOutcomePropagationRecordId: string;
  missionExecutionCoordinationPlanId: string;
  propagationClass: ExecutionCoordinationPropagationClass;
  reasonTokens: string[];
  state: RuntimeOutcomePropagationRecordState;
}

export interface MissionOrchestrationPropagation {
  missionOrchestrationPropagationId: string;
  runtimeOutcomePropagationRecordId: string;
  missionControlInterventionPlanId: string;
  propagationClass: MissionOrchestrationPropagationClass;
  reasonTokens: string[];
  state: RuntimeOutcomePropagationRecordState;
}

export interface MissionPortfolioStatePropagation {
  missionPortfolioStatePropagationId: string;
  runtimeOutcomePropagationRecordId: string;
  missionPortfolioId: string;
  propagationClass: MissionPortfolioStatePropagationClass;
  reasonTokens: string[];
  state: RuntimeOutcomePropagationRecordState;
}

export interface RuntimeOutcomePropagationHistoryEvent {
  runtimeOutcomePropagationRecordId: string;
  eventType: RuntimeOutcomePropagationHistoryEventType;
  eventDedupeKey: string;
  reasonTokens: string[];
  payload: Record<string, unknown>;
}

export interface RuntimeOutcomePropagationHistory {
  runtimeOutcomePropagationRecordId: string;
  entries: RuntimeOutcomePropagationHistoryEvent[];
}

export interface RuntimeOutcomePropagationProjection {
  runtimeOutcomePropagationRecordId: string;
  record: RuntimeOutcomePropagationRecord;
  activationPropagationSummaries: ActivationLifecyclePropagation[];
  executionCoordinationPropagationSummaries: ExecutionCoordinationPropagation[];
  missionOrchestrationPropagationSummaries: MissionOrchestrationPropagation[];
  missionPortfolioPropagationSummaries: MissionPortfolioStatePropagation[];
  status: RuntimeOutcomePropagationStatus;
  outcome: RuntimeOutcomePropagationOutcome;
  linkedExecutionAttemptIds: string[];
  propagationHistory: RuntimeOutcomePropagationHistory;
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}
