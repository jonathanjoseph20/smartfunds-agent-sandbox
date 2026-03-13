import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  ExecutionActivationFeedbackClass,
  ExecutionActivationHistoryEventType,
  ExecutionActivationRule,
  ExecutionActivationStatus,
  ExecutionActivationEligibilityValue,
  MissionExecutionActivationQueueState,
} from './mission-execution-activation-types.ts';

export function uniqueSortedStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeCanonicalRecord(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

export function deriveExecutionActivationRecordId(input: {
  executionRequestRecordId: string;
  missionExecutionCoordinationPlanId: string;
  executionIntentId: string;
  targetExecutionDomain: string;
  priority: string;
}): string {
  return sha256(canonicalStringify({
    executionRequestRecordId: input.executionRequestRecordId,
    missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
    executionIntentId: input.executionIntentId,
    targetExecutionDomain: input.targetExecutionDomain,
    priority: input.priority,
  }));
}

export function deriveExecutionRequestActivationMappingId(input: {
  executionRequestRecordId: string;
  executionActivationRecordId: string;
  activationRule: ExecutionActivationRule;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    executionRequestRecordId: input.executionRequestRecordId,
    executionActivationRecordId: input.executionActivationRecordId,
    activationRule: input.activationRule,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveExecutionActivationEligibilityId(input: {
  executionRequestRecordId: string;
  eligibilityStatus: ExecutionActivationEligibilityValue;
  reasonTokens?: string[];
  blockingConditionTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    executionRequestRecordId: input.executionRequestRecordId,
    eligibilityStatus: input.eligibilityStatus,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    blockingConditionTokens: uniqueSortedStrings(input.blockingConditionTokens),
  }));
}

export function deriveMissionExecutionActivationQueueEntryId(input: {
  executionActivationRecordId: string;
  priority: string;
  queueState: MissionExecutionActivationQueueState;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    executionActivationRecordId: input.executionActivationRecordId,
    priority: input.priority,
    queueState: input.queueState,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveExecutionActivationFeedbackLinkId(input: {
  executionActivationRecordId: string;
  executionRequestRecordId: string;
  executionAttemptId?: string | null;
  taskExecutionRunId?: string | null;
  workerResultId?: string | null;
  feedbackClass: ExecutionActivationFeedbackClass;
}): string {
  return sha256(canonicalStringify({
    executionActivationRecordId: input.executionActivationRecordId,
    executionRequestRecordId: input.executionRequestRecordId,
    executionAttemptId: input.executionAttemptId ?? null,
    taskExecutionRunId: input.taskExecutionRunId ?? null,
    workerResultId: input.workerResultId ?? null,
    feedbackClass: input.feedbackClass,
  }));
}

export function deriveExecutionActivationHistoryEventDedupeKey(input: {
  executionActivationRecordId: string;
  eventType: ExecutionActivationHistoryEventType;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    executionActivationRecordId: input.executionActivationRecordId,
    eventType: input.eventType,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    payload: normalizeCanonicalRecord(input.payload),
  }));
}

export function deriveActivationStatusFromQueueState(input: {
  queueState: MissionExecutionActivationQueueState | null;
  hasFeedback: boolean;
}): ExecutionActivationStatus {
  if (input.queueState === 'deferred') {
    return 'activation_deferred';
  }
  if (input.queueState === 'blocked') {
    return 'activation_failed';
  }
  if (input.queueState === 'closed') {
    return 'activation_completed';
  }
  if (input.queueState === 'under_activation') {
    return 'activation_active';
  }
  if (input.queueState === 'handoff_submitted') {
    return 'handoff_submitted';
  }
  if (input.queueState === 'queued' || input.queueState === 'awaiting_handoff') {
    return 'pending_activation';
  }
  if (input.hasFeedback) {
    return 'pending_activation';
  }
  return 'not_started';
}
