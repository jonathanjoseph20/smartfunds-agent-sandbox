import type { ApprovalRequest } from '../models/approvalRequest.ts';
import { parseCreateApprovalInput, parseDecideApprovalInput } from '../models/approvalRequest.ts';
import { createApproval, decideApproval, listApprovalQueue } from '../service/approvals.ts';
import { CockpitError } from '../service/invariants.ts';
import type { CockpitApiContext, CockpitApiRequest, CockpitApiResponse } from './_common.ts';
import { parseBody, parseIntegerParam, response, withErrorHandling } from './_common.ts';

function parseApprovalStatus(value: string | null): ApprovalRequest['status'] | null {
  if (value === null) {
    return null;
  }
  if (value === 'pending' || value === 'approved' || value === 'denied' || value === 'expired') {
    return value;
  }
  throw new CockpitError(400, 'status must be one of pending|approved|denied|expired');
}

export function handleApprovalsRoutes(request: CockpitApiRequest, ctx: CockpitApiContext): CockpitApiResponse | null {
  return withErrorHandling(() => {
    if (
      request.method === 'POST' &&
      request.pathname.startsWith('/runs/') &&
      request.pathname.includes('/attempts/') &&
      request.pathname.endsWith('/approvals')
    ) {
      const parts = request.pathname.split('/').filter(Boolean);
      const runId = parts[1] ?? '';
      const attemptIndex = parseIntegerParam(parts[3] ?? '', 'attemptIndex');
      const input = parseCreateApprovalInput(parseBody(request.bodyText));

      const result = createApproval(ctx.db, runId, attemptIndex, input);
      return response(result.created ? 201 : 200, result.approval);
    }

    if (request.method === 'GET' && request.pathname === '/approvals') {
      const projectId = request.query?.get('projectId') ?? '';
      if (projectId.trim().length === 0) {
        return response(400, { error: 'projectId is required' });
      }
      const status = parseApprovalStatus(request.query?.get('status') ?? null);
      return response(200, listApprovalQueue(ctx.db, projectId, status));
    }

    if (request.method === 'POST' && request.pathname.startsWith('/approvals/') && request.pathname.endsWith('/approve')) {
      const approvalRequestId = request.pathname.slice('/approvals/'.length, -'/approve'.length);
      const input = parseDecideApprovalInput(parseBody(request.bodyText));
      const approval = decideApproval(ctx.db, approvalRequestId, 'approved', input);
      return response(200, approval);
    }

    if (request.method === 'POST' && request.pathname.startsWith('/approvals/') && request.pathname.endsWith('/deny')) {
      const approvalRequestId = request.pathname.slice('/approvals/'.length, -'/deny'.length);
      const input = parseDecideApprovalInput(parseBody(request.bodyText));
      const approval = decideApproval(ctx.db, approvalRequestId, 'denied', input);
      return response(200, approval);
    }

    return null;
  });
}
