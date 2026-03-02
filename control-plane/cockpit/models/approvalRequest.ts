import { optionalIdempotencyKey, optionalObject, optionalString, requireObject, requireString } from './_common.ts';

export interface ApprovalRequest {
  approvalRequestId: string;
  projectId: string;
  runId: string;
  attemptIndex: number;
  actionType: string;
  actionPayloadHash: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requestedByRef: string | null;
  reviewedByRef: string | null;
  decisionReason: string | null;
  idempotencyKey: string | null;
}

export interface CreateApprovalInput {
  actionType: string;
  actionPayload: Record<string, unknown> | null;
  requestedByRef: string | null;
  idempotencyKey: string | null;
}

export interface DecideApprovalInput {
  reviewedByRef: string | null;
  decisionReason: string | null;
  idempotencyKey: string | null;
}

export function parseCreateApprovalInput(value: unknown): CreateApprovalInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    actionType: requireString(body.actionType, 'actionType'),
    actionPayload: optionalObject(body.actionPayload, 'actionPayload'),
    requestedByRef: optionalString(body.requestedByRef, 'requestedByRef'),
    idempotencyKey: optionalIdempotencyKey(body.idempotencyKey)
  };
}

export function parseDecideApprovalInput(value: unknown): DecideApprovalInput {
  const body = requireObject(value, 'request body must be an object');
  return {
    reviewedByRef: optionalString(body.reviewedByRef, 'reviewedByRef'),
    decisionReason: optionalString(body.decisionReason, 'decisionReason'),
    idempotencyKey: optionalIdempotencyKey(body.idempotencyKey)
  };
}
