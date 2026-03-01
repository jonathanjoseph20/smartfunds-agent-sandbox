import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { createExecutionJournal } from '../execution/journal.ts';
import type { NormalizedFailure } from '../execution/error-classification.ts';
import { assertEnvelopeHashMatch, buildEnvelopeIdentityV1 } from '../execution/envelope.ts';
import { computeAttemptId } from '../execution/retry.ts';
import { createRuntimeService } from '../execution/runtime-service.ts';
import { runSwarmExecution } from '../swarms/swarmExecutor.ts';
import { runSwarmExecutor } from '../swarm/swarm-executor.ts';
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
  swarmExecutor?: typeof runSwarmExecutor;
}

export interface ServiceDispatchRequest {
  method: string;
  pathname: string;
  bodyText: string | null;
  query?: URLSearchParams;
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

interface RunSwarmRequestBody {
  projectId: string;
  swarmId: string;
  mode: 'structured' | 'autonomous';
  intent: string;
  runIndex: number;
  changedPaths: string[];
  triggerType?: 'manual' | 'ci_failure' | 'webhook' | 'preflight';
  repo?: { owner: string; name: string };
  ref?: { base: string; head: string };
  impliedTier?: number;
  declaredTier?: number;
  mutationEnvelopeHash?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function validateRunSwarmRequestBody(value: unknown): { ok: true; value: RunSwarmRequestBody } | { ok: false } {
  if (!isPlainObject(value)) {
    return { ok: false };
  }

  const projectId = value.projectId;
  const swarmId = value.swarmId;
  const mode = value.mode;
  const intent = value.intent;
  const runIndex = value.runIndex;
  const changedPaths = value.changedPaths;
  const triggerType = value.triggerType;
  const repo = value.repo;
  const ref = value.ref;
  const impliedTier = value.impliedTier;
  const declaredTier = value.declaredTier;
  const mutationEnvelopeHash = value.mutationEnvelopeHash;

  if (!isNonEmptyString(projectId) || !isNonEmptyString(swarmId) || !isNonEmptyString(intent)) {
    return { ok: false };
  }
  if (mode !== 'structured' && mode !== 'autonomous') {
    return { ok: false };
  }
  if (!Number.isInteger(runIndex) || runIndex < 1) {
    return { ok: false };
  }
  if (!Array.isArray(changedPaths) || changedPaths.some((entry) => typeof entry !== 'string')) {
    return { ok: false };
  }
  if (triggerType !== undefined && triggerType !== 'manual' && triggerType !== 'ci_failure' && triggerType !== 'webhook' && triggerType !== 'preflight') {
    return { ok: false };
  }
  if (repo !== undefined && (!isPlainObject(repo) || !isNonEmptyString(repo.owner) || !isNonEmptyString(repo.name))) {
    return { ok: false };
  }
  if (ref !== undefined && (!isPlainObject(ref) || !isNonEmptyString(ref.base) || !isNonEmptyString(ref.head))) {
    return { ok: false };
  }
  if (impliedTier !== undefined && !isNonNegativeInteger(impliedTier)) {
    return { ok: false };
  }
  if (declaredTier !== undefined && !isNonNegativeInteger(declaredTier)) {
    return { ok: false };
  }
  if (mutationEnvelopeHash !== undefined && !isNonEmptyString(mutationEnvelopeHash)) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      projectId,
      swarmId,
      mode,
      intent,
      runIndex,
      changedPaths,
      ...(triggerType !== undefined ? { triggerType } : {}),
      ...(repo !== undefined ? { repo: { owner: repo.owner, name: repo.name } } : {}),
      ...(ref !== undefined ? { ref: { base: ref.base, head: ref.head } } : {}),
      ...(impliedTier !== undefined ? { impliedTier } : {}),
      ...(declaredTier !== undefined ? { declaredTier } : {}),
      ...(mutationEnvelopeHash !== undefined ? { mutationEnvelopeHash } : {})
    }
  };
}

function toFailureCategory(code: string): NormalizedFailure['category'] {
  const normalized = code.trim().toUpperCase();
  if (normalized.includes('GOVERNANCE') || normalized.includes('OWNERSHIP') || normalized.includes('TIER') || normalized.includes('EVIDENCE')) {
    return 'governance';
  }
  if (normalized.includes('LINT')) {
    return 'lint';
  }
  if (normalized.includes('TYPECHECK') || normalized.includes('TSC')) {
    return 'typecheck';
  }
  if (normalized.includes('UNIT')) {
    return 'unit';
  }
  if (normalized.includes('INTEGRATION')) {
    return 'integration';
  }
  if (normalized.includes('SCHEMA')) {
    return 'schema';
  }
  if (normalized.includes('INFRA')) {
    return 'infra';
  }
  return 'unknown';
}

export function createServiceDispatcher(options: ServiceOptions = {}) {
  const db = getServiceDb(options.dbPath);
  const now = options.now ?? (() => new Date().toISOString());
  const executionJournal = createExecutionJournal(db);
  const runtimeService = createRuntimeService(executionJournal);
  const runExecutor = options.swarmExecutor ?? runSwarmExecutor;

  return async function dispatch(request: ServiceDispatchRequest): Promise<ServiceDispatchResponse> {
    if (request.method === 'GET' && request.pathname === '/health') {
      return buildResponse(200, {
        status: 'ok',
        service: 'execution'
      });
    }

    if (request.method === 'POST' && request.pathname === '/run/swarm') {
      const parsed = parseJsonBody(request.bodyText);
      if (!parsed.ok) {
        return buildResponse(400, { error: 'ERR_INVALID_REQUEST' });
      }

      const validated = validateRunSwarmRequestBody(parsed.value);
      if (!validated.ok) {
        return buildResponse(400, { error: 'ERR_INVALID_REQUEST' });
      }

      const envelopeIdentity = buildEnvelopeIdentityV1({
        triggerType: validated.value.triggerType ?? 'manual',
        repo: validated.value.repo ?? { owner: 'local', name: 'smartfunds-agent-sandbox' },
        ref: validated.value.ref ?? { base: 'main', head: 'HEAD' },
        changedPaths: validated.value.changedPaths,
        declaredTier: validated.value.declaredTier ?? 0,
        impliedTier: validated.value.impliedTier ?? 0,
        executionMode: validated.value.mode,
        errorClass: null,
        failureSignature: null
      });
      const created = runtimeService.createOrGetRun(envelopeIdentity);
      const runId = created.runId;

      if (validated.value.mutationEnvelopeHash) {
        try {
          assertEnvelopeHashMatch(created.envelopeHash, validated.value.mutationEnvelopeHash);
        } catch (error) {
          return buildResponse(409, {
            error: (error as { code?: string }).code ?? 'ERR_ENVELOPE_HASH_MISMATCH',
            message: (error as Error).message
          });
        }
      }

      const existing = runtimeService.getRun(runId);
      if (existing && existing.events.length > 0) {
        return buildResponse(200, {
          ...existing,
          alreadyRecorded: true
        });
      }

      const attempt0Id = computeAttemptId(runId, 0);
      if (validated.value.changedPaths.length === 0) {
        runtimeService.appendEvent(runId, attempt0Id, {
          eventType: 'STATE_TRANSITION',
          previousState: 'CREATED',
          nextState: 'NO_WORK',
          envelopeHash: created.envelopeHash
        });
        const noWorkRun = runtimeService.getRun(runId);
        return buildResponse(200, noWorkRun ?? { runId, envelopeHash: created.envelopeHash });
      }

      runtimeService.appendEvent(runId, attempt0Id, {
        eventType: 'STATE_TRANSITION',
        previousState: 'CREATED',
        nextState: 'RUNNING',
        envelopeHash: created.envelopeHash
      });

      try {
        const result = runExecutor({
          projectId: validated.value.projectId,
          swarmId: validated.value.swarmId,
          executionMode: validated.value.mode,
          intent: validated.value.intent,
          runIndex: validated.value.runIndex
        }, {});

        if (!result.ok) {
          const failure = { code: result.code, message: result.code };
          const normalizedFailure: NormalizedFailure = {
            checkName: 'run_swarm',
            category: toFailureCategory(failure.code),
            normalizedMessage: failure.message,
            code: failure.code
          };
          const classified = runtimeService.classifyFailure(normalizedFailure);

          runtimeService.appendEvent(runId, attempt0Id, {
            eventType: 'ERROR_CLASSIFIED',
            envelopeHash: created.envelopeHash,
            errorClass: classified.errorClass,
            failureSignature: classified.failureSignature
          });

          runtimeService.appendEvent(runId, attempt0Id, {
            eventType: 'STATE_TRANSITION',
            previousState: 'RUNNING',
            nextState: 'FAILED',
            envelopeHash: created.envelopeHash,
            errorClass: classified.errorClass,
            failureSignature: classified.failureSignature
          });

          const retryRequest = runtimeService.requestRetry(runId);
          if (retryRequest.accepted && retryRequest.attemptIndex === 1) {
            const attempt1Id = computeAttemptId(runId, 1);

            const retryResult = runExecutor({
              projectId: validated.value.projectId,
              swarmId: validated.value.swarmId,
              executionMode: validated.value.mode,
              intent: validated.value.intent,
              runIndex: validated.value.runIndex
            }, {});

            if (retryResult.ok) {
              const retryCanonical = canonicalStringify(retryResult);
              runtimeService.appendEvent(runId, attempt1Id, {
                eventType: 'STATE_TRANSITION',
                previousState: 'RETRY_RUNNING',
                nextState: 'RETRY_SUCCEEDED',
                envelopeHash: created.envelopeHash,
                resultHash: sha256(retryCanonical)
              });

              const completed = runtimeService.getRun(runId);
              return buildResponse(200, {
                ...completed,
                retryAttempted: true
              });
            }

            const retryFailure = runtimeService.classifyFailure({
              checkName: 'run_swarm_retry',
              category: toFailureCategory(retryResult.code),
              normalizedMessage: retryResult.code,
              code: retryResult.code
            });
            runtimeService.appendEvent(runId, attempt1Id, {
              eventType: 'ERROR_CLASSIFIED',
              envelopeHash: created.envelopeHash,
              errorClass: retryFailure.errorClass,
              failureSignature: retryFailure.failureSignature
            });
            runtimeService.appendEvent(runId, attempt1Id, {
              eventType: 'STATE_TRANSITION',
              previousState: 'RETRY_RUNNING',
              nextState: 'RETRY_FAILED',
              envelopeHash: created.envelopeHash,
              errorClass: retryFailure.errorClass,
              failureSignature: retryFailure.failureSignature
            });

            const failedAfterRetry = runtimeService.getRun(runId);
            return buildResponse(409, {
              error: 'ERR_EXECUTION_FAILED',
              retryEligible: true,
              run: failedAfterRetry
            });
          }

          const failed = runtimeService.getRun(runId);
          return buildResponse(409, {
            error: 'ERR_EXECUTION_FAILED',
            retryEligible: retryRequest.accepted,
            retryReason: retryRequest.reason,
            run: failed
          });
        }

        const resultCanonical = canonicalStringify(result);
        runtimeService.appendEvent(runId, attempt0Id, {
          eventType: 'STATE_TRANSITION',
          previousState: 'RUNNING',
          nextState: 'SUCCEEDED',
          envelopeHash: created.envelopeHash,
          resultHash: sha256(resultCanonical)
        });
        const completed = runtimeService.getRun(runId);
        return buildResponse(200, completed ?? { error: 'ERR_EXECUTION_FAILED' });
      } catch {
        const fallbackFailure: NormalizedFailure = {
          checkName: 'run_swarm',
          category: 'unknown',
          normalizedMessage: 'ERR_EXECUTION_FAILED',
          code: 'ERR_EXECUTION_FAILED'
        };
        const classified = runtimeService.classifyFailure(fallbackFailure);
        runtimeService.appendEvent(runId, attempt0Id, {
          eventType: 'ERROR_CLASSIFIED',
          envelopeHash: created.envelopeHash,
          errorClass: classified.errorClass,
          failureSignature: classified.failureSignature
        });
        runtimeService.appendEvent(runId, attempt0Id, {
          eventType: 'STATE_TRANSITION',
          previousState: 'RUNNING',
          nextState: 'FAILED',
          envelopeHash: created.envelopeHash,
          errorClass: classified.errorClass,
          failureSignature: classified.failureSignature
        });
        const failed = runtimeService.getRun(runId);
        return buildResponse(500, {
          error: 'ERR_EXECUTION_FAILED',
          run: failed
        });
      }
    }

    if (request.method === 'POST' && request.pathname.startsWith('/run/') && request.pathname.endsWith('/retry')) {
      const runId = request.pathname.slice('/run/'.length, -'/retry'.length).trim();
      if (runId.length === 0) {
        return buildResponse(404, { error: 'ERR_RUN_NOT_FOUND' });
      }

      const run = runtimeService.getRun(runId);
      if (!run) {
        return buildResponse(404, { error: 'ERR_RUN_NOT_FOUND' });
      }

      const retryResult = runtimeService.requestRetry(runId);
      return buildResponse(200, retryResult);
    }

    if (request.method === 'GET' && request.pathname.startsWith('/run/')) {
      const runId = request.pathname.slice('/run/'.length).trim();
      if (runId.length === 0) {
        return buildResponse(404, { error: 'ERR_RUN_NOT_FOUND' });
      }

      const run = runtimeService.getRun(runId);
      if (!run) {
        return buildResponse(404, { error: 'ERR_RUN_NOT_FOUND' });
      }

      return buildResponse(200, run);
    }

    if (request.method === 'GET' && request.pathname === '/runs') {
      const runs = runtimeService.listRuns();
      return buildResponse(200, { runs });
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
        }, {
          db,
          now: createdAt
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
      bodyText,
      query: requestUrl.searchParams
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
