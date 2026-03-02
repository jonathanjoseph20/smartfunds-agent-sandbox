import type { DatabaseSync } from 'node:sqlite';

import type { ApprovalRequest } from '../models/approvalRequest.ts';
import { all, one } from './_shared.ts';

interface ApprovalRequestRow {
  approval_request_id: string;
  project_id: string;
  run_id: string;
  attempt_index: number;
  action_type: string;
  action_payload_hash: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requested_by_ref: string | null;
  reviewed_by_ref: string | null;
  decision_reason: string | null;
  idempotency_key: string | null;
}

function toApprovalRequest(row: ApprovalRequestRow): ApprovalRequest {
  return {
    approvalRequestId: row.approval_request_id,
    projectId: row.project_id,
    runId: row.run_id,
    attemptIndex: row.attempt_index,
    actionType: row.action_type,
    actionPayloadHash: row.action_payload_hash,
    status: row.status,
    requestedByRef: row.requested_by_ref,
    reviewedByRef: row.reviewed_by_ref,
    decisionReason: row.decision_reason,
    idempotencyKey: row.idempotency_key
  };
}

export function createApprovalRequest(db: DatabaseSync, approval: ApprovalRequest): ApprovalRequest {
  db.prepare(
    `INSERT INTO cockpit_approval_requests
    (approval_request_id, project_id, run_id, attempt_index, action_type, action_payload_hash, status, requested_by_ref, reviewed_by_ref, decision_reason, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    approval.approvalRequestId,
    approval.projectId,
    approval.runId,
    approval.attemptIndex,
    approval.actionType,
    approval.actionPayloadHash,
    approval.status,
    approval.requestedByRef,
    approval.reviewedByRef,
    approval.decisionReason,
    approval.idempotencyKey
  );
  return approval;
}

export function getApprovalRequestById(db: DatabaseSync, approvalRequestId: string): ApprovalRequest | null {
  const row = one<ApprovalRequestRow>(
    db,
    `SELECT approval_request_id, project_id, run_id, attempt_index, action_type, action_payload_hash, status,
            requested_by_ref, reviewed_by_ref, decision_reason, idempotency_key
     FROM cockpit_approval_requests
     WHERE approval_request_id = ?`,
    approvalRequestId
  );
  return row ? toApprovalRequest(row) : null;
}

export function getApprovalByAttemptAndIdempotencyKey(
  db: DatabaseSync,
  runId: string,
  attemptIndex: number,
  key: string
): ApprovalRequest | null {
  const row = one<ApprovalRequestRow>(
    db,
    `SELECT approval_request_id, project_id, run_id, attempt_index, action_type, action_payload_hash, status,
            requested_by_ref, reviewed_by_ref, decision_reason, idempotency_key
     FROM cockpit_approval_requests
     WHERE run_id = ? AND attempt_index = ? AND idempotency_key = ?`,
    runId,
    attemptIndex,
    key
  );
  return row ? toApprovalRequest(row) : null;
}

export function listApprovalRequestsByRun(db: DatabaseSync, runId: string): ApprovalRequest[] {
  return all<ApprovalRequestRow>(
    db,
    `SELECT approval_request_id, project_id, run_id, attempt_index, action_type, action_payload_hash, status,
            requested_by_ref, reviewed_by_ref, decision_reason, idempotency_key
     FROM cockpit_approval_requests
     WHERE run_id = ?
     ORDER BY attempt_index ASC, approval_request_id ASC`,
    runId
  ).map(toApprovalRequest);
}

export function listApprovalRequestsByProjectAndStatus(
  db: DatabaseSync,
  projectId: string,
  status: ApprovalRequest['status'] | null
): ApprovalRequest[] {
  const sql = status
    ? `SELECT approval_request_id, project_id, run_id, attempt_index, action_type, action_payload_hash, status,
              requested_by_ref, reviewed_by_ref, decision_reason, idempotency_key
       FROM cockpit_approval_requests
       WHERE project_id = ? AND status = ?
       ORDER BY approval_request_id ASC`
    : `SELECT approval_request_id, project_id, run_id, attempt_index, action_type, action_payload_hash, status,
              requested_by_ref, reviewed_by_ref, decision_reason, idempotency_key
       FROM cockpit_approval_requests
       WHERE project_id = ?
       ORDER BY approval_request_id ASC`;
  const rows = status ? all<ApprovalRequestRow>(db, sql, projectId, status) : all<ApprovalRequestRow>(db, sql, projectId);
  return rows.map(toApprovalRequest);
}

export function updateApprovalDecision(db: DatabaseSync, approval: ApprovalRequest): ApprovalRequest {
  db.prepare(
    `UPDATE cockpit_approval_requests
     SET status = ?, reviewed_by_ref = ?, decision_reason = ?
     WHERE approval_request_id = ?`
  ).run(approval.status, approval.reviewedByRef, approval.decisionReason, approval.approvalRequestId);
  return approval;
}
