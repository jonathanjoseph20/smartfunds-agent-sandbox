import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { createCockpitRunRepo } from '../execution/cockpit/run.repo.ts';
import { CockpitRunServiceError, createCockpitRunService } from '../execution/cockpit/run.service.ts';
import { createExecutionJournal } from '../execution/journal.ts';
import type { NormalizedFailure } from '../execution/error-classification.ts';
import { assertEnvelopeHashMatch, buildEnvelopeIdentityV1 } from '../execution/envelope.ts';
import { computeAttemptId } from '../execution/retry.ts';
import type { RunLifecycleState } from '../execution/run-lifecycle.ts';
import type { RunRecord, RuntimeEvent } from '../execution/types.ts';
import { createRuntimeService } from '../execution/runtime-service.ts';
import { resolveEntityTelemetry } from '../studio/entity-registry.ts';
import { runSwarmExecution } from '../swarms/swarmExecutor.ts';
import { runSwarmExecutor } from '../swarm/swarm-executor.ts';
import { processGithubWebhookEvent } from '../webhooks/github/process.ts';
import { verifyGithubSignature, type GithubSignatureError } from '../webhooks/github/signature.ts';
import type { CiContextResolver, SupportedGithubEventType } from '../webhooks/github/types.ts';
import { extractRunIdFromSlackActionPayload } from './integrations/slack/actions.ts';
import {
  computeSlackWebhookEventId,
  normalizeSlackActionPayload,
  normalizeSlackEventEnvelope,
  parseSlackActionPayload,
  parseSlackEventEnvelope
} from './integrations/slack/normalize.ts';
import {
  buildLifecycleNotificationId,
  createSlackNotifier,
  isRetryButtonEligible,
  type SlackNotificationError
} from './integrations/slack/notifier.ts';
import { verifySlackSignature, type SlackSignatureError } from './integrations/slack/signature.ts';
import { resolveHandlerRoute } from './handlers/router.ts';
import type { HandlerResult } from './handlers/types.ts';
import type { SlackNotifier } from './integrations/slack/types.ts';
import { toSwarmExecutionArgs } from './http/types.ts';
import { validateExecuteRequestBody, validateWebhookSource } from './http/validation.ts';
import { evaluateReadiness } from './readiness.ts';
import {
  RATE_LIMIT_EXCEEDED_RESPONSE,
  RateLimiter,
  resolveRateLimitConfig,
  resolveRequesterDimension
} from './rate-limit.ts';
import { validateStartupInvariants } from './startup-invariants.ts';
import { getServiceDb } from './storage/db.ts';
import { computeEventId, getEventById, insertReceivedEvent, updateEventStatus } from './storage/events.ts';
import {
  appendJournalEntry,
  countJournalByTypeAndRefId,
  computeEventIngestRunId,
  computeSwarmRunId,
  computeWebhookDuplicateIgnoredRunId,
  hasJournalRunId
} from './storage/journal.ts';
import { computeTaskId, insertQueuedTask, updateTaskStatus } from './storage/tasks.ts';

const DEFAULT_SERVICE_PORT = 3000;
const GITHUB_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;

export interface ServiceOptions {
  dbPath?: string;
  now?: () => string;
  swarmExecutor?: typeof runSwarmExecutor;
  slackNotifier?: SlackNotifier;
  slackSigningSecret?: string;
  slackNowSeconds?: () => number;
  githubWebhookSecret?: string;
  githubCiContextResolver?: CiContextResolver;
}

export interface ServiceDispatchRequest {
  method: string;
  pathname: string;
  bodyText: string | null;
  query?: URLSearchParams;
  headers?: Record<string, string | undefined>;
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

function resolveHeader(headers: Record<string, string | undefined> | undefined, key: string): string | undefined {
  if (!headers) {
    return undefined;
  }
  const direct = headers[key];
  if (direct !== undefined) {
    return direct;
  }
  return headers[key.toLowerCase()];
}

function isJsonContentType(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'application/json' || normalized.startsWith('application/json;');
}

type AuditRunItem = {
  runId: string;
  state: string;
  entityId: string | null;
  projectId: string | null;
  swarmId: string | null;
  attemptCount: number;
  retryConsumed: boolean;
  errorClass: string | null;
  failureSignature: string | null;
  envelopeHash: string;
};

function parseEnvelopeCanonical(envelopeCanonical: string): {
  diff?: {
    projectIdsTouched?: string[];
    teamIdsTouched?: string[];
  };
} {
  try {
    return JSON.parse(envelopeCanonical) as {
      diff?: {
        projectIdsTouched?: string[];
        teamIdsTouched?: string[];
      };
    };
  } catch {
    return {};
  }
}

function resolveRunEntity(projectIdsTouched: string[]): string | null {
  const telemetry = resolveEntityTelemetry(projectIdsTouched);
  if (telemetry.telemetry.entityOwnershipStatus !== 'ok') {
    return null;
  }

  return telemetry.telemetry.entitiesTouched[0] ?? null;
}

function toAuditRunItem(run: RunRecord): AuditRunItem {
  const envelope = parseEnvelopeCanonical(run.envelopeCanonical);
  const projectIds = Array.isArray(envelope.diff?.projectIdsTouched) ? envelope.diff?.projectIdsTouched : [];
  const teamIds = Array.isArray(envelope.diff?.teamIdsTouched) ? envelope.diff?.teamIdsTouched : [];
  const latestFailure = [...run.events]
    .reverse()
    .find((event) => event.eventType === 'STATE_TRANSITION' && (
      event.nextState === 'FAILED' || event.nextState === 'RETRY_FAILED'
    ));

  return {
    runId: run.runId,
    state: run.latestState,
    entityId: resolveRunEntity(projectIds),
    projectId: projectIds[0] ?? null,
    swarmId: teamIds[0] ?? null,
    attemptCount: run.attempts.length,
    retryConsumed: run.attempts.some((attempt) => attempt.attemptIndex === 1),
    errorClass: latestFailure?.errorClass ?? null,
    failureSignature: latestFailure?.failureSignature ?? null,
    envelopeHash: run.envelopeHash
  };
}

function parseLimit(value: string | null, defaultLimit: number, maxLimit: number): number {
  if (!value) {
    return defaultLimit;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultLimit;
  }
  if (parsed > maxLimit) {
    return maxLimit;
  }
  return parsed;
}

export function createServiceDispatcher(options: ServiceOptions = {}) {
  const db = getServiceDb(options.dbPath);
  const now = options.now ?? (() => new Date().toISOString());
  const slackNowSeconds = options.slackNowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const slackNotifier = options.slackNotifier ?? createSlackNotifier({
    botToken: process.env.SLACK_BOT_TOKEN,
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    defaultChannel: process.env.SLACK_DEFAULT_CHANNEL
  });
  const slackSigningSecret = options.slackSigningSecret ?? process.env.SLACK_SIGNING_SECRET ?? '';
  const githubWebhookSecret = options.githubWebhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET ?? '';
  const githubCiContextResolver = options.githubCiContextResolver;
  const serviceBaseUrl = process.env.SERVICE_BASE_URL;
  const slackConfigured = Boolean(
    (process.env.SLACK_BOT_TOKEN && process.env.SLACK_DEFAULT_CHANNEL) ||
    process.env.SLACK_WEBHOOK_URL
  );
  const executionJournal = createExecutionJournal(db);
  const runtimeService = createRuntimeService(executionJournal);
  const cockpitRunRepo = createCockpitRunRepo();
  const cockpitRunService = createCockpitRunService({ repo: cockpitRunRepo });
  const runExecutor = options.swarmExecutor ?? runSwarmExecutor;
  const rateLimitResolution = resolveRateLimitConfig(process.env);
  const rateLimiter = new RateLimiter(rateLimitResolution.config.windowMs);

  function shouldRateLimit(
    request: ServiceDispatchRequest,
    routeType: 'runs:create' | 'runs:retry' | 'slack:events' | 'slack:actions'
  ): boolean {
    const requester = resolveRequesterDimension(request.headers);
    const key = `${routeType}:${requester}`;
    let limit = rateLimitResolution.config.maxRequests;
    if (routeType === 'runs:create') {
      limit = rateLimitResolution.config.runCreateMax;
    } else if (routeType === 'slack:actions') {
      limit = rateLimitResolution.config.slackActionMax;
    }

    const result = rateLimiter.checkAndIncrement(key, limit);
    return !result.allowed;
  }

  function appendWebhookDuplicateIgnored(
    webhookEventId: string,
    webhookType: 'action' | 'event'
  ): void {
    const refId = `slack:${webhookType}:${webhookEventId}`;
    const sequence = countJournalByTypeAndRefId(db, 'WEBHOOK_DUPLICATE_IGNORED', refId);
    const payload = {
      webhookEventId,
      source: 'slack',
      type: webhookType
    } as const;

    appendJournalEntry(db, {
      run_id: computeWebhookDuplicateIgnoredRunId(webhookEventId, webhookType, sequence),
      type: 'WEBHOOK_DUPLICATE_IGNORED',
      ref_id: refId,
      result_hash: sha256(canonicalStringify(payload)),
      created_at: now()
    });
  }

  async function notifyLifecycleState(
    run: RunRecord,
    state: RunLifecycleState,
    attemptIndex: number
  ): Promise<void> {
    const notificationId = buildLifecycleNotificationId({
      runId: run.runId,
      state,
      attemptIndex
    });

    if (hasJournalRunId(db, notificationId, 'slack_notification')) {
      return;
    }

    try {
      const retryEligible = state === 'FAILED' && attemptIndex === 0 ? isRetryButtonEligible(run) : false;
      await slackNotifier.postLifecycleNotification(run, state, {
        retryEligible,
        serviceBaseUrl
      });
    } catch (error) {
      const slackError = error as SlackNotificationError;
      if (slackError?.name !== 'SlackNotificationError') {
        return;
      }
      return;
    }

    appendJournalEntry(db, {
      run_id: notificationId,
      type: 'slack_notification',
      ref_id: run.runId,
      result_hash: sha256(canonicalStringify({
        runId: run.runId,
        state,
        attemptIndex
      })),
      created_at: now()
    });
  }

  async function notifyPendingLifecycleTransitions(runId: string): Promise<void> {
    const run = runtimeService.getRun(runId);
    if (!run) {
      return;
    }

    for (const event of run.events) {
      if (event.eventType !== 'STATE_TRANSITION' || !event.nextState) {
        continue;
      }
      await notifyLifecycleState(run, event.nextState, event.attemptIndex);
    }
  }

  async function appendRuntimeEvent(runId: string, attemptId: string, event: RuntimeEvent): Promise<void> {
    runtimeService.appendEvent(runId, attemptId, event);
    if (event.eventType !== 'STATE_TRANSITION' || !event.nextState) {
      return;
    }
    const run = runtimeService.getRun(runId);
    if (!run) {
      return;
    }
    const matchingEvent = [...run.events]
      .reverse()
      .find((entry) => entry.eventType === 'STATE_TRANSITION' && entry.nextState === event.nextState && entry.attemptId === attemptId);
    await notifyLifecycleState(run, event.nextState, matchingEvent?.attemptIndex ?? 0);
  }

  return async function dispatch(request: ServiceDispatchRequest): Promise<ServiceDispatchResponse> {
    if (request.method === 'POST' && request.pathname === '/cockpit/runs') {
      const parsed = parseJsonBody(request.bodyText);
      if (!parsed.ok) {
        return buildResponse(400, { error: 'ERR_COCKPIT_INVALID_RUN_INPUT' });
      }

      try {
        const run = cockpitRunService.createRun(parsed.value as {
          projectId: string;
          teamId: string;
          goalId: string;
        });
        return buildResponse(201, {
          runId: run.runId,
          status: run.status,
          attemptIndex: run.attemptIndex
        });
      } catch (error) {
        if (error instanceof CockpitRunServiceError) {
          if (error.code === 'ERR_COCKPIT_GOAL_NOT_FOUND') {
            return buildResponse(404, { error: error.message });
          }
          if (error.code === 'ERR_COCKPIT_GOAL_SCOPE_MISMATCH') {
            return buildResponse(409, { error: error.message });
          }
          if (error.code === 'ERR_COCKPIT_INVALID_RUN_INPUT') {
            return buildResponse(400, { error: error.code });
          }
          return buildResponse(400, { error: error.code });
        }

        if (error instanceof Error && error.message === 'ERR_COCKPIT_INVALID_RUN_INPUT') {
          return buildResponse(400, { error: error.message });
        }
        return buildResponse(500, { error: 'ERR_COCKPIT_RUN_CREATE_FAILED' });
      }
    }

    if (request.method === 'GET' && request.pathname.startsWith('/cockpit/runs/')) {
      const runId = request.pathname.slice('/cockpit/runs/'.length).trim();
      if (runId.length === 0) {
        return buildResponse(404, { error: 'ERR_COCKPIT_RUN_NOT_FOUND' });
      }

      const run = cockpitRunRepo.getRun(runId);
      if (!run) {
        return buildResponse(404, { error: 'ERR_COCKPIT_RUN_NOT_FOUND' });
      }

      return buildResponse(200, run);
    }

    if (request.method === 'GET' && request.pathname.startsWith('/cockpit/projects/') && request.pathname.endsWith('/runs')) {
      const projectId = request.pathname.slice('/cockpit/projects/'.length, -'/runs'.length).trim();
      if (projectId.length === 0) {
        return buildResponse(400, { error: 'ERR_COCKPIT_INVALID_PROJECT_ID' });
      }
      return buildResponse(200, { runs: cockpitRunRepo.listRunsByProject(projectId) });
    }

    if (request.method === 'GET' && request.pathname.startsWith('/cockpit/goals/') && request.pathname.endsWith('/runs')) {
      const goalId = request.pathname.slice('/cockpit/goals/'.length, -'/runs'.length).trim();
      if (goalId.length === 0) {
        return buildResponse(400, { error: 'ERR_COCKPIT_INVALID_GOAL_ID' });
      }
      return buildResponse(200, { runs: cockpitRunRepo.listRunsByGoal(goalId) });
    }

    if (request.method === 'POST' && request.pathname === '/webhooks/github') {
      if (!isJsonContentType(resolveHeader(request.headers, 'content-type'))) {
        return buildResponse(415, { error: 'unsupported_media_type: expected_application_json' });
      }

      const rawBody = request.bodyText ?? '';
      if (Buffer.byteLength(rawBody, 'utf8') > GITHUB_WEBHOOK_MAX_BODY_BYTES) {
        return buildResponse(413, { error: 'payload_too_large' });
      }

      try {
        verifyGithubSignature({
          secret: githubWebhookSecret,
          rawBody,
          signatureHeader: resolveHeader(request.headers, 'x-hub-signature-256')
        });
      } catch (error) {
        const signatureError = error as GithubSignatureError;
        return buildResponse(signatureError.statusCode ?? 401, { error: signatureError.code ?? 'unauthorized: invalid_signature' });
      }

      const githubEvent = resolveHeader(request.headers, 'x-github-event')?.trim();
      if (githubEvent !== 'check_run' && githubEvent !== 'workflow_run') {
        return buildResponse(204, { ok: true, status: 'ignored' });
      }

      const deliveryId = resolveHeader(request.headers, 'x-github-delivery')?.trim();
      if (!deliveryId) {
        return buildResponse(400, { error: 'invalid_request: missing_delivery_id' });
      }

      const parsed = parseJsonBody(rawBody);
      if (!parsed.ok) {
        return buildResponse(400, { error: 'invalid_json' });
      }

      const processed = processGithubWebhookEvent({
        eventType: githubEvent as SupportedGithubEventType,
        deliveryId,
        payload: parsed.value,
        contextResolver: githubCiContextResolver,
        triggerRetry: ({ runId }) => {
          const retry = runtimeService.requestRetry(runId);
          return {
            accepted: retry.accepted,
            reason: retry.reason ?? (retry.accepted ? 'retry_scheduled' : 'retry_blocked')
          };
        }
      });

      return buildResponse(200, {
        ok: true,
        status: processed.dedupeHit ? 'duplicate_ignored' : 'processed',
        normalizedHash: processed.envelope.normalizedHash,
        retry: processed.retry
      });
    }

    if (request.method === 'GET' && request.pathname === '/health') {
      let journalConnectivityOk = true;
      try {
        db.prepare('SELECT 1 AS ok').get();
      } catch {
        journalConnectivityOk = false;
      }

      return buildResponse(200, {
        status: 'ok',
        service: 'execution',
        version: process.env.SERVICE_VERSION ?? null,
        build: process.env.SERVICE_BUILD_SHA ?? null,
        journalConnectivityOk,
        slackConfigured
      });
    }

    if (request.method === 'GET' && request.pathname === '/ready') {
      return buildResponse(200, evaluateReadiness({
        db,
        env: process.env
      }));
    }

    if (request.method === 'POST' && request.pathname === '/run/swarm') {
      if (shouldRateLimit(request, 'runs:create')) {
        return buildResponse(429, RATE_LIMIT_EXCEEDED_RESPONSE);
      }

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
        await appendRuntimeEvent(runId, attempt0Id, {
          eventType: 'STATE_TRANSITION',
          previousState: 'CREATED',
          nextState: 'NO_WORK',
          envelopeHash: created.envelopeHash
        });
        const noWorkRun = runtimeService.getRun(runId);
        return buildResponse(200, noWorkRun ?? { runId, envelopeHash: created.envelopeHash });
      }

      await appendRuntimeEvent(runId, attempt0Id, {
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

          await appendRuntimeEvent(runId, attempt0Id, {
            eventType: 'ERROR_CLASSIFIED',
            envelopeHash: created.envelopeHash,
            errorClass: classified.errorClass,
            failureSignature: classified.failureSignature
          });

          await appendRuntimeEvent(runId, attempt0Id, {
            eventType: 'STATE_TRANSITION',
            previousState: 'RUNNING',
            nextState: 'FAILED',
            envelopeHash: created.envelopeHash,
            errorClass: classified.errorClass,
            failureSignature: classified.failureSignature
          });

          const retryRequest = runtimeService.requestRetry(runId);
          await notifyPendingLifecycleTransitions(runId);
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
              await appendRuntimeEvent(runId, attempt1Id, {
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
            await appendRuntimeEvent(runId, attempt1Id, {
              eventType: 'ERROR_CLASSIFIED',
              envelopeHash: created.envelopeHash,
              errorClass: retryFailure.errorClass,
              failureSignature: retryFailure.failureSignature
            });
            await appendRuntimeEvent(runId, attempt1Id, {
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
        await appendRuntimeEvent(runId, attempt0Id, {
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
        await appendRuntimeEvent(runId, attempt0Id, {
          eventType: 'ERROR_CLASSIFIED',
          envelopeHash: created.envelopeHash,
          errorClass: classified.errorClass,
          failureSignature: classified.failureSignature
        });
        await appendRuntimeEvent(runId, attempt0Id, {
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
      if (shouldRateLimit(request, 'runs:retry')) {
        return buildResponse(429, RATE_LIMIT_EXCEEDED_RESPONSE);
      }

      const runId = request.pathname.slice('/run/'.length, -'/retry'.length).trim();
      if (runId.length === 0) {
        return buildResponse(404, { error: 'ERR_RUN_NOT_FOUND' });
      }

      const run = runtimeService.getRun(runId);
      if (!run) {
        return buildResponse(404, { error: 'ERR_RUN_NOT_FOUND' });
      }

      const retryResult = runtimeService.requestRetry(runId);
      await notifyPendingLifecycleTransitions(runId);
      return buildResponse(200, retryResult);
    }

    if (request.method === 'POST' && request.pathname === '/webhooks/slack/actions') {
      if (shouldRateLimit(request, 'slack:actions')) {
        return buildResponse(429, RATE_LIMIT_EXCEEDED_RESPONSE);
      }

      if (!slackSigningSecret) {
        return buildResponse(503, { error: 'SLACK_NOT_CONFIGURED' });
      }

      const rawBody = request.bodyText ?? '';
      try {
        verifySlackSignature({
          signingSecret: slackSigningSecret,
          rawBody,
          slackSignatureHeader: resolveHeader(request.headers, 'x-slack-signature'),
          slackTimestampHeader: resolveHeader(request.headers, 'x-slack-request-timestamp'),
          nowSeconds: slackNowSeconds
        });
      } catch (error) {
        const signatureError = error as SlackSignatureError;
        return buildResponse(signatureError.statusCode ?? 401, { error: signatureError.code ?? 'SLACK_SIGNATURE_INVALID' });
      }

      const payload = parseSlackActionPayload(rawBody);
      if (!payload) {
        return buildResponse(400, { error: 'ERR_INVALID_ACTION_PAYLOAD' });
      }

      const normalizedPayload = normalizeSlackActionPayload(payload);
      const webhookEventId = computeSlackWebhookEventId({
        webhookType: 'slack_actions',
        normalizedPayload
      });

      if (hasJournalRunId(db, webhookEventId, 'webhook_intake')) {
        appendWebhookDuplicateIgnored(webhookEventId, 'action');
        const duplicateRunId = extractRunIdFromSlackActionPayload(payload);
        const duplicateRun = duplicateRunId ? runtimeService.getRun(duplicateRunId) : null;
        const duplicateRetryConsumed = Boolean(duplicateRun?.attempts.some((attempt) => attempt.attemptIndex === 1));
        if (duplicateRetryConsumed) {
          return buildResponse(200, { accepted: false, reasonCode: 'RETRY_ALREADY_CONSUMED' });
        }
        return buildResponse(200, { ok: true, status: 'duplicate_ignored', webhookEventId });
      }

      const runId = extractRunIdFromSlackActionPayload(payload);
      if (!runId) {
        appendJournalEntry(db, {
          run_id: webhookEventId,
          type: 'webhook_intake',
          ref_id: 'slack_actions:unknown:unknown',
          result_hash: sha256(canonicalStringify(normalizedPayload)),
          created_at: now()
        });
        return buildResponse(400, { error: 'ERR_INVALID_ACTION_PAYLOAD', webhookEventId });
      }

      const run = runtimeService.getRun(runId);
      const retryConsumed = Boolean(run?.attempts.some((attempt) => attempt.attemptIndex === 1));
      if (retryConsumed) {
        appendJournalEntry(db, {
          run_id: webhookEventId,
          type: 'webhook_intake',
          ref_id: `slack_actions:${runId}:retry`,
          result_hash: sha256(canonicalStringify({
            normalizedPayload,
            retryResult: { accepted: false, reasonCode: 'RETRY_ALREADY_CONSUMED' }
          })),
          created_at: now()
        });
        return buildResponse(200, { accepted: false, reasonCode: 'RETRY_ALREADY_CONSUMED' });
      }

      const retryResult = runtimeService.requestRetry(runId);
      if (retryResult.accepted) {
        await notifyPendingLifecycleTransitions(runId);
      }

      appendJournalEntry(db, {
        run_id: webhookEventId,
        type: 'webhook_intake',
        ref_id: `slack_actions:${runId}:retry`,
        result_hash: sha256(canonicalStringify({
          normalizedPayload,
          retryResult
        })),
        created_at: now()
      });

      if (retryResult.accepted) {
        return buildResponse(200, {
          ok: true,
          status: 'retry_scheduled',
          attemptIndex: retryResult.attemptIndex,
          message: `Retry scheduled (attemptIndex=${String(retryResult.attemptIndex ?? 1)})`,
          webhookEventId
        });
      }

      return buildResponse(200, {
        ok: true,
        status: 'rejected',
        reasonCode: retryResult.reason ?? 'UNKNOWN_REASON',
        webhookEventId
      });
    }

    if (request.method === 'POST' && request.pathname === '/webhooks/slack/events') {
      if (shouldRateLimit(request, 'slack:events')) {
        return buildResponse(429, RATE_LIMIT_EXCEEDED_RESPONSE);
      }

      if (!slackSigningSecret) {
        return buildResponse(503, { error: 'SLACK_NOT_CONFIGURED' });
      }

      const rawBody = request.bodyText ?? '';
      try {
        verifySlackSignature({
          signingSecret: slackSigningSecret,
          rawBody,
          slackSignatureHeader: resolveHeader(request.headers, 'x-slack-signature'),
          slackTimestampHeader: resolveHeader(request.headers, 'x-slack-request-timestamp'),
          nowSeconds: slackNowSeconds
        });
      } catch (error) {
        const signatureError = error as SlackSignatureError;
        return buildResponse(signatureError.statusCode ?? 401, { error: signatureError.code ?? 'SLACK_SIGNATURE_INVALID' });
      }

      const envelope = parseSlackEventEnvelope(rawBody);
      if (!envelope) {
        return buildResponse(400, { error: 'INVALID_JSON' });
      }

      const normalizedPayload = normalizeSlackEventEnvelope(envelope);
      const webhookEventId = computeSlackWebhookEventId({
        webhookType: 'slack_events',
        normalizedPayload
      });

      if (hasJournalRunId(db, webhookEventId, 'webhook_intake')) {
        appendWebhookDuplicateIgnored(webhookEventId, 'event');
        return buildResponse(200, { ok: true, status: 'duplicate_ignored', webhookEventId });
      }

      appendJournalEntry(db, {
        run_id: webhookEventId,
        type: 'webhook_intake',
        ref_id: `slack_events:${envelope.event_id ?? 'unknown'}`,
        result_hash: sha256(canonicalStringify(normalizedPayload)),
        created_at: now()
      });

      if (envelope.type === 'url_verification' && typeof envelope.challenge === 'string') {
        return buildResponse(200, { ok: true, challenge: envelope.challenge, webhookEventId });
      }

      return buildResponse(200, { ok: true, status: 'processed', webhookEventId });
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

    if (request.method === 'GET' && request.pathname === '/audit/runs') {
      const entityId = request.query?.get('entityId')?.trim();
      if (!entityId) {
        return buildResponse(400, { error: 'ERR_INVALID_REQUEST' });
      }

      const stateFilter = request.query?.get('state')?.trim();
      const cursor = request.query?.get('cursor')?.trim();
      const limit = parseLimit(request.query?.get('limit') ?? null, 50, 200);

      const items = runtimeService
        .listRuns()
        .map(toAuditRunItem)
        .filter((item) => item.entityId === entityId)
        .filter((item) => !stateFilter || item.state === stateFilter)
        .filter((item) => !cursor || item.runId > cursor)
        .slice(0, limit);

      return buildResponse(200, {
        cursor: items.length > 0 ? items[items.length - 1]?.runId ?? null : null,
        items
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
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value ?? undefined])
    );

    const response = await dispatch({
      method,
      pathname: requestUrl.pathname,
      bodyText,
      query: requestUrl.searchParams,
      headers
    });

    sendJson(res, response.statusCode, response.payload);
  });
}

export async function startService(
  portInput = process.env.PORT ?? process.env.SERVICE_PORT,
  hostInput = process.env.HOST ?? '127.0.0.1'
): Promise<void> {
  validateStartupInvariants();
  if (!process.env.GITHUB_WEBHOOK_SECRET || process.env.GITHUB_WEBHOOK_SECRET.trim().length === 0) {
    throw new Error('STARTUP_INVARIANT_FAILED: GITHUB_WEBHOOK_SECRET_MISSING');
  }
  const parsed = Number.parseInt(portInput ?? `${DEFAULT_SERVICE_PORT}`, 10);
  const port = Number.isNaN(parsed) ? DEFAULT_SERVICE_PORT : parsed;
  const host = hostInput.trim().length > 0 ? hostInput : '127.0.0.1';
  const server = createServiceServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      process.stdout.write(`service_started host=${host} port=${port}\n`);
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
