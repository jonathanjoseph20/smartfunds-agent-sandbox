import { canonicalStringify } from '../../finance/determinism.ts';
import { parseCreateArtifactInput, parsePatchArtifactInput } from '../models/prArtifact.ts';
import {
  appendRunEvent,
  createPRArtifact,
  getPRArtifactById,
  getRunById,
  nextCounterId,
  nextEventSeq,
  updatePRArtifact,
  withTransaction
} from '../storage/index.ts';
import { CockpitError, requireRunAttemptRecord } from '../service/invariants.ts';
import type { CockpitApiContext, CockpitApiRequest, CockpitApiResponse } from './_common.ts';
import { jsonOrNull, parseBody, parseIntegerParam, response, withErrorHandling } from './_common.ts';

function appendArtifactEvent(
  ctx: CockpitApiContext,
  runId: string,
  attemptIndex: number,
  type: string,
  payload: Record<string, unknown>
): void {
  const seq = nextEventSeq(ctx.db, runId, attemptIndex);
  appendRunEvent(ctx.db, {
    runId,
    attemptIndex,
    eventSeq: seq,
    type,
    payloadJson: canonicalStringify(payload),
    envelopeHash: null
  });
}

export function handleArtifactsRoutes(request: CockpitApiRequest, ctx: CockpitApiContext): CockpitApiResponse | null {
  return withErrorHandling(() => {
    if (
      request.method === 'POST' &&
      request.pathname.startsWith('/runs/') &&
      request.pathname.includes('/attempts/') &&
      request.pathname.endsWith('/artifacts')
    ) {
      const parts = request.pathname.split('/').filter(Boolean);
      const runId = parts[1] ?? '';
      const attemptIndex = parseIntegerParam(parts[3] ?? '', 'attemptIndex');
      const input = parseCreateArtifactInput(parseBody(request.bodyText));

      const artifact = withTransaction(ctx.db, () => {
        const run = getRunById(ctx.db, runId);
        if (!run) {
          throw new CockpitError(404, 'run not found');
        }
        requireRunAttemptRecord(ctx.db, runId, attemptIndex);

        const created = createPRArtifact(ctx.db, {
          artifactId: nextCounterId(ctx.db, 'artifact'),
          projectId: run.projectId,
          runId,
          attemptIndex,
          kind: input.kind,
          status: input.status,
          externalUrl: input.externalUrl,
          externalRef: input.externalRef,
          metadataJson: input.metadata ? canonicalStringify(input.metadata) : null
        });

        appendArtifactEvent(ctx, runId, attemptIndex, 'ARTIFACT_RECORDED', {
          artifactId: created.artifactId,
          status: created.status
        });

        if (created.status === 'ready') {
          appendArtifactEvent(ctx, runId, attemptIndex, 'ARTIFACT_READY', {
            artifactId: created.artifactId,
            status: created.status
          });
        }

        return created;
      });

      return response(201, {
        ...artifact,
        metadataJson: jsonOrNull(artifact.metadataJson)
      });
    }

    if (request.method === 'PATCH' && request.pathname.startsWith('/artifacts/')) {
      const artifactId = request.pathname.slice('/artifacts/'.length).trim();
      const current = getPRArtifactById(ctx.db, artifactId);
      if (!current) {
        throw new CockpitError(404, 'artifact not found');
      }

      const input = parsePatchArtifactInput(parseBody(request.bodyText));
      const updated = withTransaction(ctx.db, () => {
        const next = updatePRArtifact(ctx.db, {
          ...current,
          status: input.status ?? current.status,
          externalUrl: input.externalUrl === undefined ? current.externalUrl : input.externalUrl,
          externalRef: input.externalRef === undefined ? current.externalRef : input.externalRef,
          metadataJson: input.metadata === undefined ? current.metadataJson : (input.metadata ? canonicalStringify(input.metadata) : null)
        });

        if (current.status !== 'ready' && next.status === 'ready') {
          appendArtifactEvent(ctx, next.runId, next.attemptIndex, 'ARTIFACT_READY', {
            artifactId: next.artifactId,
            status: next.status
          });
        }

        return next;
      });

      return response(200, {
        ...updated,
        metadataJson: jsonOrNull(updated.metadataJson)
      });
    }

    return null;
  });
}
