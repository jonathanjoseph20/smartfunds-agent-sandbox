import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { runSwarmExecution } from '../swarms/swarmExecutor.ts';
import { resolveHandlerRoute } from './handlers/router.ts';
import type { HandlerResult } from './handlers/types.ts';
import { toSwarmExecutionArgs } from './http/types.ts';
import { validateExecuteRequestBody, validateWebhookSource } from './http/validation.ts';
import { getServiceDb } from './storage/db.ts';
import { computeEventId, getEventById, insertReceivedEvent, updateEventStatus } from './storage/events.ts';
import { appendJournalEntry, computeEventIngestRunId, computeSwarmRunId } from './storage/journal.ts';
import { computeTaskId, insertQueuedTask, updateTaskStatus } from './storage/tasks.ts';

const DEFAULT_SERVICE_PORT = 3000;

export interface ServiceOptions {
  dbPath?: string;
  now?: () => string;
}

export interface ServiceDispatchRequest {
  method: string;
  pathname: string;
  bodyText: string | null;
}

export interface ServiceDispatchResponse {
  statusCode: number;
  payload: unknown;
}

function isDeterministicSwarmError(error: unknown): boolean {
  const message = (error as Error).message;
  return typeof message === 'string' && (
    message.startsWith('INVALID_ARGUMENT:') ||
    message.startsWith('MISSING_ARGUMENT:') ||
    message.startsWith('UNKNOWN_ARGUMENT:') ||
    message.startsWith('SWARM_') ||
    message.startsWith('PROJECT_') ||
    message.startsWith('TEAM_') ||
    message.startsWith('MODE_MISMATCH:') ||
    message.startsWith('ENTITY_BINDING_') ||
    message.startsWith('RAIL_BINDING_') ||
    message.startsWith('ARTIFACT_PATH_OUTSIDE_PROJECT_BOUNDS:') ||
    message.startsWith('BRANCH_ALREADY_EXISTS:')
  );
}

function parseJsonBody(bodyText: string | null): { ok: true; value: unknown } | { ok: false } {
  if (!bodyText || bodyText.trim().length === 0) {
    return { ok: false };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(bodyText) as unknown
    };
  } catch {
    return { ok: false };
  }
}

function buildResponse(statusCode: number, payload: unknown): ServiceDispatchResponse {
  return { statusCode, payload };
}

export function createServiceDispatcher(options: ServiceOptions = {}) {
  const db = getServiceDb(options.dbPath);
  const now = options.now ?? (() => new Date().toISOString());

  return async function dispatch(request: ServiceDispatchRequest): Promise<ServiceDispatchResponse> {
    if (request.method === 'GET' && request.pathname === '/health') {
      return buildResponse(200, {
        status: 'ok',
        service: 'smartfunds-agent-sandbox',
        version: 'v1'
      });
    }

    if (request.method === 'POST' && request.pathname === '/execute') {
      const parsed = parseJsonBody(request.bodyText);
      if (!parsed.ok) {
        return buildResponse(400, { error: 'INVALID_JSON' });
      }

      const validated = validateExecuteRequestBody(parsed.value);
      if (!validated.ok) {
        return buildResponse(400, validated.error);
      }

      try {
        const result = await runSwarmExecution(toSwarmExecutionArgs(validated.value));
        const canonicalResult = canonicalStringify(result);
        const runId = computeSwarmRunId(canonicalResult);
        const resultHash = typeof result.deterministicHash === 'string'
          ? result.deterministicHash
          : sha256(canonicalResult);

        appendJournalEntry(db, {
          run_id: runId,
          type: 'swarm_execute',
          ref_id: result.branchName ?? '',
          result_hash: resultHash,
          created_at: now()
        });

        return buildResponse(200, result);
      } catch (error) {
        if (isDeterministicSwarmError(error)) {
          return buildResponse(400, { error: (error as Error).message });
        }
        return buildResponse(500, { error: 'unexpected_runtime_error' });
      }
    }

    if (request.method === 'POST' && request.pathname.startsWith('/webhooks/')) {
      const sourceValidation = validateWebhookSource(request.pathname.slice('/webhooks/'.length));
      if (!sourceValidation.ok) {
        return buildResponse(400, sourceValidation.error);
      }

      const parsed = parseJsonBody(request.bodyText);
      if (!parsed.ok) {
        return buildResponse(400, { error: 'INVALID_JSON' });
      }

      const route = resolveHandlerRoute(sourceValidation.source);
      if (!route) {
        return buildResponse(400, {
          ok: false,
          code: 'unknown_source',
          summaryCanonical: canonicalStringify({ source: sourceValidation.source, note: 'unknown_source' })
        });
      }

      const canonicalPayload = canonicalStringify(parsed.value);
      const eventId = computeEventId(sourceValidation.source, canonicalPayload);
      const existing = getEventById(db, eventId);

      if (existing) {
        return buildResponse(200, {
          ok: true,
          code: 'idempotent_replay',
          summaryCanonical: canonicalStringify({
            source: sourceValidation.source,
            event_id: eventId,
            status: existing.status,
            message: 'duplicate_ignored'
          })
        });
      }

      const createdAt = now();
      insertReceivedEvent(db, {
        event_id: eventId,
        source: sourceValidation.source,
        payload_canonical: canonicalPayload,
        created_at: createdAt
      });

      const taskId = computeTaskId(eventId, route.handlerName, 0);
      insertQueuedTask(db, {
        task_id: taskId,
        event_id: eventId,
        handler: route.handlerName,
        attempt_index: 0,
        created_at: createdAt
      });
      updateTaskStatus(db, taskId, 'running', null);

      let handlerResult: HandlerResult;
      let statusCode = 200;

      try {
        handlerResult = route.handler.handle({
          event_id: eventId,
          source: sourceValidation.source,
          payload_canonical: canonicalPayload
        });
      } catch {
        statusCode = 500;
        handlerResult = {
          ok: false,
          code: 'handler_runtime_error',
          summaryCanonical: canonicalStringify({ source: sourceValidation.source, event_id: eventId, note: 'failed' })
        };
      }

      const canonicalHandlerResult = canonicalStringify(handlerResult);
      if (handlerResult.ok) {
        updateTaskStatus(db, taskId, 'done', canonicalHandlerResult);
        updateEventStatus(db, eventId, 'processed', null);
      } else {
        updateTaskStatus(db, taskId, 'failed', canonicalHandlerResult);
        updateEventStatus(db, eventId, 'failed', handlerResult.code);
      }

      appendJournalEntry(db, {
        run_id: computeEventIngestRunId(sourceValidation.source, eventId, canonicalHandlerResult),
        type: 'event_ingest',
        ref_id: eventId,
        result_hash: sha256(canonicalHandlerResult),
        created_at: createdAt
      });

      return buildResponse(statusCode, handlerResult);
    }

    return buildResponse(404, { error: 'not_found' });
  };
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(`${JSON.stringify(payload)}\n`);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createServiceServer(options: ServiceOptions = {}) {
  const dispatch = createServiceDispatcher(options);

  return createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const requestUrl = new URL(req.url ?? '/', 'http://localhost');
    const bodyText = method === 'GET' ? null : await readBody(req);

    const response = await dispatch({
      method,
      pathname: requestUrl.pathname,
      bodyText
    });

    sendJson(res, response.statusCode, response.payload);
  });
}

export async function startService(portInput = process.env.SERVICE_PORT): Promise<void> {
  const parsed = Number.parseInt(portInput ?? `${DEFAULT_SERVICE_PORT}`, 10);
  const port = Number.isNaN(parsed) ? DEFAULT_SERVICE_PORT : parsed;
  const server = createServiceServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      process.stdout.write(`service_started port=${port}\n`);
      resolve();
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startService().catch(() => {
    process.stdout.write('{"error":"service_start_failed"}\n');
    process.exit(1);
  });
}
