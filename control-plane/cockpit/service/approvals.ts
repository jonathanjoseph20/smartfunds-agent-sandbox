import type { DatabaseSync } from 'node:sqlite';

import { canonicalStringify, sha256 } from '../../finance/determinism.ts';
import type { ApprovalRequest } from '../models/approvalRequest.ts';
import {
  appendRunEvent,
  createApprovalRequest,
  getApprovalByAttemptAndIdempotencyKey,
  getApprovalRequestById,
  getRunById,
  listApprovalRequestsByProjectAndStatus,
  nextCounterId,
  nextEventSeq,
  updateApprovalDecision,
  withTransaction
} from '../storage/index.ts';
import { CockpitError, requireRunAttemptRecord } from './invariants.ts';
import { resolveIdempotentResource, saveIdempotencyResource } from './idempotency.ts';

function appendApprovalEvent(
  db: DatabaseSync,
  runId: string,
  attemptIndex: number,
  type: string,
  payload: Record<string, unknown>
): void {
  const eventSeq = nextEventSeq(db, runId, attemptIndex);
  appendRunEvent(db, {
    runId,
    attemptIndex,
    eventSeq,
    type,
    payloadJson: canonicalStringify(payload),
    envelopeHash: null
  });
}

export function createApproval(
  db: DatabaseSync,
  runId: string,
  attemptIndex: number,
  input: {
    actionType: string;
    actionPayload: Record<string, unknown> | null;
    requestedByRef: string | null;
    idempotencyKey: string | null;
  }
): { approval: ApprovalRequest; created: boolean } {
  return withTransaction(db, () => {
    const run = getRunById(db, runId);
    if (!run) {
      throw new CockpitError(404, 'run not found');
    }
    requireRunAttemptRecord(db, runId, attemptIndex);

    if (input.idempotencyKey) {
      const byAttempt = getApprovalByAttemptAndIdempotencyKey(db, runId, attemptIndex, input.idempotencyKey);
      if (byAttempt) {
        return { approval: byAttempt, created: false };
      }
    }

    const scope = `create-approval:${runId}:${String(attemptIndex)}`;
    const existingReference = resolveIdempotentResource(db, scope, input.idempotencyKey);
    if (existingReference?.resourceType === 'approval') {
      const existing = getApprovalRequestById(db, existingReference.resourceId);
      if (existing) {
        return { approval: existing, created: false };
      }
    }

    const actionPayloadCanonical = canonicalStringify(input.actionPayload ?? null);
    const approvalRequestId = nextCounterId(db, 'approval');
    const approval: ApprovalRequest = {
      approvalRequestId,
      projectId: run.projectId,
      runId,
      attemptIndex,
      actionType: input.actionType,
      actionPayloadHash: sha256(actionPayloadCanonical),
      status: 'pending',
      requestedByRef: input.requestedByRef,
      reviewedByRef: null,
      decisionReason: null,
      idempotencyKey: input.idempotencyKey
    };

    createApprovalRequest(db, approval);

    appendApprovalEvent(db, runId, attemptIndex, 'APPROVAL_REQUESTED', {
      approvalRequestId,
      actionType: input.actionType,
      status: 'pending'
    });

    saveIdempotencyResource(db, scope, input.idempotencyKey, 'approval', approvalRequestId);
    return { approval, created: true };
  });
}

export function decideApproval(
  db: DatabaseSync,
  approvalRequestId: string,
  decision: 'approved' | 'denied',
  input: {
    reviewedByRef: string | null;
    decisionReason: string | null;
    idempotencyKey: string | null;
  }
): ApprovalRequest {
  return withTransaction(db, () => {
    const approval = getApprovalRequestById(db, approvalRequestId);
    if (!approval) {
      throw new CockpitError(404, 'approval request not found');
    }

    const scope = `approval-decision:${approvalRequestId}`;
    const existingReference = resolveIdempotentResource(db, scope, input.idempotencyKey);
    if (existingReference?.resourceType === 'approval') {
      const existing = getApprovalRequestById(db, existingReference.resourceId);
      if (existing) {
        return existing;
      }
    }

    if (approval.status !== 'pending') {
      if (approval.status === decision) {
        saveIdempotencyResource(db, scope, input.idempotencyKey, 'approval', approval.approvalRequestId);
        return approval;
      }
      throw new CockpitError(409, 'approval decision is immutable');
    }

    const updated: ApprovalRequest = {
      ...approval,
      status: decision,
      reviewedByRef: input.reviewedByRef,
      decisionReason: input.decisionReason
    };
    updateApprovalDecision(db, updated);

    appendApprovalEvent(db, approval.runId, approval.attemptIndex, 'APPROVAL_DECIDED', {
      approvalRequestId: approval.approvalRequestId,
      status: decision
    });

    saveIdempotencyResource(db, scope, input.idempotencyKey, 'approval', approval.approvalRequestId);
    return updated;
  });
}

export function listApprovalQueue(
  db: DatabaseSync,
  projectId: string,
  status: ApprovalRequest['status'] | null
): ApprovalRequest[] {
  return listApprovalRequestsByProjectAndStatus(db, projectId, status);
}
