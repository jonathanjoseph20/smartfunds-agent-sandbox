import { parseStartRunInput } from '../models/run.ts';
import { parseRetryRunInput } from '../models/runAttempt.ts';
import { getRunById, listPRArtifactsByRun } from '../storage/index.ts';
import { CockpitError } from '../service/invariants.ts';
import { getRunDetail, listGoalRuns, retryRun, startRun } from '../service/runLifecycle.ts';
import type { CockpitApiContext, CockpitApiRequest, CockpitApiResponse } from './_common.ts';
import { jsonOrNull, parseBody, response, withErrorHandling } from './_common.ts';

function formatRunDetail(detail: ReturnType<typeof getRunDetail>) {
  return {
    run: detail.run,
    attempts: detail.attempts.map((entry) => ({
      attempt: entry.attempt,
      events: entry.events.map((event) => ({
        ...event,
        payloadJson: jsonOrNull(event.payloadJson)
      })),
      approvals: entry.approvals,
      artifacts: entry.artifacts.map((artifact) => ({
        ...artifact,
        metadataJson: jsonOrNull(artifact.metadataJson)
      }))
    }))
  };
}

export function handleRunsRoutes(request: CockpitApiRequest, ctx: CockpitApiContext): CockpitApiResponse | null {
  return withErrorHandling(() => {
    if (request.method === 'POST' && /^\/goals\/[^/]+\/runs$/.test(request.pathname)) {
      const goalId = request.pathname.split('/')[2] ?? '';
      const input = parseStartRunInput(parseBody(request.bodyText));
      const result = startRun(ctx.db, goalId, input.idempotencyKey);
      return response(result.created ? 201 : 200, result.run);
    }

    if (request.method === 'GET' && /^\/goals\/[^/]+\/runs$/.test(request.pathname)) {
      const goalId = request.pathname.split('/')[2] ?? '';
      return response(200, listGoalRuns(ctx.db, goalId));
    }

    if (request.method === 'GET' && /^\/runs\/[^/]+\/artifacts$/.test(request.pathname)) {
      const runId = request.pathname.split('/')[2] ?? '';
      if (!getRunById(ctx.db, runId)) {
        throw new CockpitError(404, 'run not found');
      }
      return response(200, listPRArtifactsByRun(ctx.db, runId).map((artifact) => ({
        ...artifact,
        metadataJson: jsonOrNull(artifact.metadataJson)
      })));
    }

    if (request.method === 'GET' && /^\/runs\/[^/]+$/.test(request.pathname)) {
      const runId = request.pathname.split('/')[2] ?? '';
      const detail = getRunDetail(ctx.db, runId);
      return response(200, formatRunDetail(detail));
    }

    if (request.method === 'POST' && /^\/runs\/[^/]+\/retry$/.test(request.pathname)) {
      const runId = request.pathname.split('/')[2] ?? '';
      const input = parseRetryRunInput(parseBody(request.bodyText));
      const result = retryRun(ctx.db, runId, input.idempotencyKey);
      return response(result.created ? 201 : 200, result.attempt);
    }

    return null;
  });
}
