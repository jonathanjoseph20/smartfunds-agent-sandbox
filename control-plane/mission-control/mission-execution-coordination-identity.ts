import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  ExecutionFeedbackClass,
  ExecutionIntentClass,
  ExecutionRequestClass,
  MissionExecutionCoordinationHistoryEventType,
  MissionExecutionCoordinationPlanState,
  MissionExecutionCoordinationOutcome,
} from './mission-execution-coordination-types.ts';

export function uniqueSortedStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeCanonicalRecord(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

export function deriveMissionExecutionCoordinationPlanId(input: {
  missionControlInterventionPlanId: string;
  strategyClass: string;
  priority: string;
  linkedActionItemIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionControlInterventionPlanId: input.missionControlInterventionPlanId,
    strategyClass: input.strategyClass,
    priority: input.priority,
    linkedActionItemIds: uniqueSortedStrings(input.linkedActionItemIds),
  }));
}

export function deriveMissionOrchestrationExecutionMappingId(input: {
  missionControlOrchestrationActionItemId: string;
  executionIntentClass: ExecutionIntentClass;
  requestGenerationRule: string;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    missionControlOrchestrationActionItemId: input.missionControlOrchestrationActionItemId,
    executionIntentClass: input.executionIntentClass,
    requestGenerationRule: input.requestGenerationRule,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveExecutionIntentId(input: {
  missionExecutionCoordinationPlanId: string;
  intentClass: ExecutionIntentClass;
  linkedActionItemIds?: string[];
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
    intentClass: input.intentClass,
    linkedActionItemIds: uniqueSortedStrings(input.linkedActionItemIds),
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveExecutionRequestRecordId(input: {
  missionExecutionCoordinationPlanId: string;
  missionControlOrchestrationActionItemId: string;
  executionIntentId: string;
  requestClass: ExecutionRequestClass;
  targetExecutionDomain: string;
  priority: string;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
    missionControlOrchestrationActionItemId: input.missionControlOrchestrationActionItemId,
    executionIntentId: input.executionIntentId,
    requestClass: input.requestClass,
    targetExecutionDomain: input.targetExecutionDomain,
    priority: input.priority,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveExecutionFeedbackLinkId(input: {
  executionRequestRecordId: string;
  executionAttemptId?: string | null;
  taskExecutionRunId?: string | null;
  workerResultId?: string | null;
  missionControlOrchestrationActionItemId: string;
  missionExecutionCoordinationPlanId: string;
  feedbackClass: ExecutionFeedbackClass;
}): string {
  return sha256(canonicalStringify({
    executionRequestRecordId: input.executionRequestRecordId,
    executionAttemptId: input.executionAttemptId ?? null,
    taskExecutionRunId: input.taskExecutionRunId ?? null,
    workerResultId: input.workerResultId ?? null,
    missionControlOrchestrationActionItemId: input.missionControlOrchestrationActionItemId,
    missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
    feedbackClass: input.feedbackClass,
  }));
}

export function deriveMissionExecutionCoordinationHistoryEventDedupeKey(input: {
  missionExecutionCoordinationPlanId: string;
  eventType: MissionExecutionCoordinationHistoryEventType;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
    eventType: input.eventType,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    payload: normalizeCanonicalRecord(input.payload),
  }));
}

export function deriveMissionExecutionCoordinationPlanState(input: {
  priority: string;
  actionItemStates: string[];
}): MissionExecutionCoordinationPlanState {
  const states = uniqueSortedStrings(input.actionItemStates);
  if (states.includes('inconclusive')) {
    return 'inconclusive';
  }
  if (states.includes('blocked')) {
    return 'failed';
  }
  if (input.priority === 'deferred' || states.includes('deferred')) {
    return 'deferred';
  }
  if (states.includes('completed') && states.length === 1) {
    return 'completed';
  }
  if (states.includes('active')) {
    return 'active';
  }
  if (states.length > 0) {
    return 'queued';
  }
  return 'created';
}

export function deriveMissionExecutionCoordinationOutcomeFromState(state: MissionExecutionCoordinationPlanState): MissionExecutionCoordinationOutcome {
  if (state === 'completed') {
    return 'completed';
  }
  if (state === 'active') {
    return 'active';
  }
  if (state === 'failed') {
    return 'failed';
  }
  if (state === 'deferred') {
    return 'deferred';
  }
  if (state === 'inconclusive') {
    return 'inconclusive';
  }
  return 'pending';
}
