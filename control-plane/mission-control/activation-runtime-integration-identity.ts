import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  ActivationAttemptStatus,
  ActivationDispatchQueueState,
  ActivationRuntimeIntegrationHistoryEventType,
  ActivationRuntimeLinkClass,
  ActivationRuntimeReconciliationClass,
  RuntimeFeedbackIngestionClass,
  RuntimeLinkedIds,
} from './activation-runtime-integration-types.ts';

export function uniqueSortedStrings(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeCanonicalRecord(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(payload)) as Record<string, unknown>;
}

export function normalizeRuntimeLinkedIds(value: RuntimeLinkedIds | undefined): RuntimeLinkedIds {
  return {
    executionAttemptId: value?.executionAttemptId ?? null,
    taskExecutionRunId: value?.taskExecutionRunId ?? null,
    workerResultId: value?.workerResultId ?? null,
  };
}

export function deriveActivationDispatchAttemptId(input: {
  executionActivationRecordId: string;
  executionRequestRecordId: string;
  targetRuntimeDomain: string;
  priority: string;
}): string {
  return sha256(canonicalStringify({
    idClass: 'activation_dispatch_attempt',
    executionActivationRecordId: input.executionActivationRecordId,
    executionRequestRecordId: input.executionRequestRecordId,
    targetRuntimeDomain: input.targetRuntimeDomain,
    priority: input.priority,
  }));
}

export function deriveActivationDispatchQueueEntryId(input: {
  activationDispatchAttemptId: string;
  priority: string;
  queueState: ActivationDispatchQueueState;
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    idClass: 'activation_dispatch_queue_entry',
    activationDispatchAttemptId: input.activationDispatchAttemptId,
    priority: input.priority,
    queueState: input.queueState,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveActivationRuntimeLinkId(input: {
  activationDispatchAttemptId: string;
  executionActivationRecordId: string;
  executionAttemptId?: string | null;
  taskExecutionRunId?: string | null;
  workerResultId?: string | null;
  runtimeLinkClass: ActivationRuntimeLinkClass;
}): string {
  return sha256(canonicalStringify({
    idClass: 'activation_runtime_link',
    activationDispatchAttemptId: input.activationDispatchAttemptId,
    executionActivationRecordId: input.executionActivationRecordId,
    executionAttemptId: input.executionAttemptId ?? null,
    taskExecutionRunId: input.taskExecutionRunId ?? null,
    workerResultId: input.workerResultId ?? null,
    runtimeLinkClass: input.runtimeLinkClass,
  }));
}

export function deriveRuntimeFeedbackIngestionRecordId(input: {
  activationDispatchAttemptId: string;
  activationRuntimeLinkId: string;
  feedbackClass: RuntimeFeedbackIngestionClass;
  reasonTokens?: string[];
  linkedRuntimeIds?: RuntimeLinkedIds;
}): string {
  return sha256(canonicalStringify({
    idClass: 'runtime_feedback_ingestion_record',
    activationDispatchAttemptId: input.activationDispatchAttemptId,
    activationRuntimeLinkId: input.activationRuntimeLinkId,
    feedbackClass: input.feedbackClass,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    linkedRuntimeIds: normalizeRuntimeLinkedIds(input.linkedRuntimeIds),
  }));
}

export function deriveActivationRuntimeReconciliationId(input: {
  activationDispatchAttemptId: string;
  reconciliationClass: ActivationRuntimeReconciliationClass;
  linkedFeedbackRecordIds?: string[];
  reasonTokens?: string[];
}): string {
  return sha256(canonicalStringify({
    idClass: 'activation_runtime_reconciliation',
    activationDispatchAttemptId: input.activationDispatchAttemptId,
    reconciliationClass: input.reconciliationClass,
    linkedFeedbackRecordIds: uniqueSortedStrings(input.linkedFeedbackRecordIds),
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
  }));
}

export function deriveActivationRuntimeIntegrationHistoryEventDedupeKey(input: {
  activationDispatchAttemptId: string;
  eventType: ActivationRuntimeIntegrationHistoryEventType;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    idClass: 'activation_runtime_integration_history_event',
    activationDispatchAttemptId: input.activationDispatchAttemptId,
    eventType: input.eventType,
    reasonTokens: uniqueSortedStrings(input.reasonTokens),
    payload: normalizeCanonicalRecord(input.payload),
  }));
}

export function deriveAttemptStatusFromQueueState(input: {
  queueState: ActivationDispatchQueueState;
  hasFeedback: boolean;
}): ActivationAttemptStatus {
  if (input.queueState === 'deferred') {
    return 'runtime_deferred';
  }
  if (input.queueState === 'blocked') {
    return 'runtime_failed';
  }
  if (input.queueState === 'closed') {
    return 'runtime_completed';
  }
  if (input.queueState === 'under_runtime_execution') {
    return 'runtime_active';
  }
  if (input.queueState === 'dispatch_submitted') {
    return 'dispatch_submitted';
  }
  if (input.queueState === 'queued' || input.queueState === 'awaiting_dispatch') {
    return 'pending_dispatch';
  }
  if (input.hasFeedback) {
    return 'pending_dispatch';
  }
  return 'not_dispatched';
}
