import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  ActivationLifecyclePropagationClass,
  RuntimeOutcomePropagationClass,
  RuntimeOutcomePropagationHistoryEventType,
  RuntimeOutcomePropagationTargetLayer,
} from './runtime-outcome-propagation-types.ts';

export function uniqueSortedStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeCanonicalRecord(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

export function deriveRuntimeOutcomePropagationRecordId(input: {
  activationDispatchAttemptId: string;
  executionActivationRecordId: string;
  executionRequestRecordId: string;
  propagationClass: RuntimeOutcomePropagationClass;
  targetLayer: RuntimeOutcomePropagationTargetLayer;
}): string {
  return sha256(canonicalStringify({
    idClass: 'runtime_outcome_propagation_record',
    activationDispatchAttemptId: input.activationDispatchAttemptId,
    executionActivationRecordId: input.executionActivationRecordId,
    executionRequestRecordId: input.executionRequestRecordId,
    propagationClass: input.propagationClass,
    targetLayer: input.targetLayer,
  }));
}

export function deriveActivationLifecyclePropagationId(input: {
  runtimeOutcomePropagationRecordId: string;
  executionActivationRecordId: string;
  propagationClass: ActivationLifecyclePropagationClass;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    idClass: 'activation_lifecycle_propagation',
    runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
    executionActivationRecordId: input.executionActivationRecordId,
    propagationClass: input.propagationClass,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveExecutionCoordinationPropagationId(input: {
  runtimeOutcomePropagationRecordId: string;
  missionExecutionCoordinationPlanId: string;
  propagationClass: string;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    idClass: 'execution_coordination_propagation',
    runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
    missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
    propagationClass: input.propagationClass,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveMissionOrchestrationPropagationId(input: {
  runtimeOutcomePropagationRecordId: string;
  missionControlInterventionPlanId: string;
  propagationClass: string;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    idClass: 'mission_orchestration_propagation',
    runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
    missionControlInterventionPlanId: input.missionControlInterventionPlanId,
    propagationClass: input.propagationClass,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveMissionPortfolioStatePropagationId(input: {
  runtimeOutcomePropagationRecordId: string;
  missionPortfolioId: string;
  propagationClass: string;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    idClass: 'mission_portfolio_state_propagation',
    runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
    missionPortfolioId: input.missionPortfolioId,
    propagationClass: input.propagationClass,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveRuntimeOutcomePropagationHistoryEventDedupeKey(input: {
  runtimeOutcomePropagationRecordId: string;
  eventType: RuntimeOutcomePropagationHistoryEventType;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    idClass: 'runtime_outcome_propagation_history_event',
    runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
    eventType: input.eventType,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    payload: normalizeCanonicalRecord(input.payload),
  }));
}
