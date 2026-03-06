import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildEnvelopeIdentityV1, computeEnvelopeHash } from '../execution/envelope.ts';
import { createExecutionJournal } from '../execution/journal.ts';
import { computeAttemptId } from '../execution/retry.ts';
import { createRuntimeService } from '../execution/runtime-service.ts';
import { createServiceDispatcher } from './index.ts';
import { clearServiceDbRegistryForTests, getServiceDb } from './storage/db.ts';
import { resetGithubWebhookDedupeForTests } from '../webhooks/github/dedupe.ts';
import type { SwarmExecutionArgs, SwarmExecutionResult } from '../swarm/types.ts';
import type { SwarmExecutorOptions } from '../swarm/swarm-executor.ts';

const TEST_DB_PATH = ':memory:';
const ENV_SNAPSHOT = { ...process.env };

function setRateLimitEnv(values: {
  windowMs: number;
  maxRequests: number;
  slackActionMax: number;
  runCreateMax: number;
}): void {
  process.env.RATE_LIMIT_WINDOW_MS = String(values.windowMs);
  process.env.RATE_LIMIT_MAX_REQUESTS = String(values.maxRequests);
  process.env.RATE_LIMIT_SLACK_ACTION_MAX = String(values.slackActionMax);
  process.env.RATE_LIMIT_RUN_CREATE_MAX = String(values.runCreateMax);
}

function createFakeSwarmExecutor(callCounter: { count: number }) {
  return (args: SwarmExecutionArgs, _options: SwarmExecutorOptions = {}): SwarmExecutionResult => {
    callCounter.count += 1;
    return {
      ok: true,
      code: 'OK',
      projectId: args.projectId,
      swarmId: args.swarmId,
      executionMode: args.executionMode,
      runId: 'deterministic-run',
      branchName: `swarm/${args.projectId}/${args.swarmId}/run-${args.runIndex ?? 1}`,
      prNumber: 7,
      prUrl: 'https://example.test/repo/pull/7',
      appliedPatchId: 'patch-1',
      mutatedFiles: ['control-plane/service/index.ts'],
      reportHash: 'report-hash'
    };
  };
}

function createRetryingSwarmExecutor(callCounter: { count: number }) {
  return (args: SwarmExecutionArgs): SwarmExecutionResult => {
    callCounter.count += 1;
    if (callCounter.count === 1) {
      return {
        ok: false,
        code: 'LINT_FAILURE',
        projectId: args.projectId,
        swarmId: args.swarmId,
        executionMode: args.executionMode,
        runId: 'deterministic-run',
        branchName: `swarm/${args.projectId}/${args.swarmId}/run-${args.runIndex ?? 1}`,
        mutatedFiles: [],
        reportHash: 'failed'
      };
    }
    return {
      ok: true,
      code: 'OK',
      projectId: args.projectId,
      swarmId: args.swarmId,
      executionMode: args.executionMode,
      runId: 'deterministic-run',
      branchName: `swarm/${args.projectId}/${args.swarmId}/run-${args.runIndex ?? 1}`,
      prNumber: 7,
      prUrl: 'https://example.test/repo/pull/7',
      appliedPatchId: 'patch-1',
      mutatedFiles: ['control-plane/service/index.ts'],
      reportHash: 'ok'
    };
  };
}

async function dispatchJson(
  dispatch: ReturnType<typeof createServiceDispatcher>,
  method: string,
  pathname: string,
  body: unknown,
  headers?: Record<string, string>
) {
  return dispatch({
    method,
    pathname,
    bodyText: body === null ? null : JSON.stringify(body),
    headers
  });
}

async function dispatchRaw(
  dispatch: ReturnType<typeof createServiceDispatcher>,
  method: string,
  pathname: string,
  bodyText: string,
  headers: Record<string, string>
) {
  return dispatch({
    method,
    pathname,
    bodyText,
    headers
  });
}

function signSlack(secret: string, timestamp: string, bodyText: string): string {
  return `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${bodyText}`).digest('hex')}`;
}

function signGithub(secret: string, bodyText: string): string {
  return `sha256=${createHmac('sha256', secret).update(bodyText).digest('hex')}`;
}

function baseRequestBody() {
  return {
    projectId: 'core-app',
    swarmId: 'dev-team',
    mode: 'structured' as const,
    intent: 'sprint-47',
    runIndex: 1,
    changedPaths: ['control-plane/service/index.ts'],
    repo: { owner: 'smartfunds', name: 'sandbox' },
    ref: { base: 'main', head: 'feature/sprint-47' },
    declaredTier: 3,
    impliedTier: 3
  };
}

afterEach(() => {
  vi.useRealTimers();
  for (const key of Object.keys(process.env)) {
    if (!(key in ENV_SNAPSHOT)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ENV_SNAPSHOT)) {
    process.env[key] = value;
  }
});

describe.sequential('execution service unit', () => {
  beforeEach(() => {
    clearServiceDbRegistryForTests();
    resetGithubWebhookDedupeForTests();
  });

  it('validates /run/swarm request schema', async () => {
    const callCounter = { count: 0 };
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      swarmExecutor: createFakeSwarmExecutor(callCounter)
    });

    const response = await dispatchJson(dispatch, 'POST', '/run/swarm', {
      projectId: 'core-app',
      swarmId: 'dev-team',
      mode: 'structured',
      intent: 'task'
    });

    expect(response.statusCode).toBe(400);
    expect(response.payload).toEqual({ error: 'ERR_INVALID_REQUEST' });
    expect(callCounter.count).toBe(0);
  });

  it('no-work short-circuits and does not execute swarm runtime', async () => {
    const callCounter = { count: 0 };
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      swarmExecutor: createFakeSwarmExecutor(callCounter)
    });

    const response = await dispatchJson(dispatch, 'POST', '/run/swarm', {
      ...baseRequestBody(),
      changedPaths: []
    });

    expect(response.statusCode).toBe(200);
    const payload = response.payload as { latestState: string };
    expect(payload.latestState).toBe('NO_WORK');
    expect(callCounter.count).toBe(0);

    const run = response.payload as { runId: string };
    const db = getServiceDb(TEST_DB_PATH);
    const journal = createExecutionJournal(db);
    const events = journal.listRunEvents(run.runId);
    expect(events.map((event) => `${event.previousState}->${event.nextState}`)).toEqual(['CREATED->NO_WORK']);
    expect(events.some((event) => event.errorClass === 'OWNERSHIP_VIOLATION')).toBe(false);
  });

  it('GET /health returns service readiness contract', async () => {
    const dispatch = createServiceDispatcher({ dbPath: TEST_DB_PATH });
    const response = await dispatch({
      method: 'GET',
      pathname: '/health',
      bodyText: null
    });

    expect(response.statusCode).toBe(200);
    expect(response.payload).toMatchObject({
      status: 'ok',
      service: 'execution',
      journalConnectivityOk: true
    });
  });

  it('GET /ready returns missing_keys when required env is not present', async () => {
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.RATE_LIMIT_SLACK_ACTION_MAX;
    delete process.env.RATE_LIMIT_RUN_CREATE_MAX;

    const dispatch = createServiceDispatcher({ dbPath: TEST_DB_PATH });
    const response = await dispatch({
      method: 'GET',
      pathname: '/ready',
      bodyText: null
    });

    expect(response.statusCode).toBe(200);
    expect(response.payload).toEqual({
      ready: false,
      checks: {
        journal: 'ok',
        slackConfig: 'ok',
        rateLimiter: 'ok',
        env: 'missing_keys'
      }
    });
  });
});

describe.sequential('execution service integration', () => {
  beforeEach(() => {
    clearServiceDbRegistryForTests();
    resetGithubWebhookDedupeForTests();
  });

  it('duplicate trigger returns same run without duplicate events', async () => {
    const callCounter = { count: 0 };
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      swarmExecutor: createFakeSwarmExecutor(callCounter)
    });

    const body = baseRequestBody();
    const first = await dispatchJson(dispatch, 'POST', '/run/swarm', body);
    const second = await dispatchJson(dispatch, 'POST', '/run/swarm', body);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(callCounter.count).toBe(1);

    const firstRun = first.payload as { runId: string };
    const secondRun = second.payload as { runId: string; alreadyRecorded?: boolean };
    expect(firstRun.runId).toBe(secondRun.runId);
    expect(secondRun.alreadyRecorded).toBe(true);
  });

  it('emits lifecycle notifications through the notifier hook on state transitions', async () => {
    const callCounter = { count: 0 };
    const notifications: string[] = [];
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      swarmExecutor: createFakeSwarmExecutor(callCounter),
      slackNotifier: {
        async postLifecycleNotification(runSummary, state) {
          notifications.push(`${runSummary.runId}:${state}`);
          return { ok: true };
        }
      }
    });

    const response = await dispatchJson(dispatch, 'POST', '/run/swarm', baseRequestBody());
    expect(response.statusCode).toBe(200);

    expect(notifications).toHaveLength(2);
    expect(notifications[0]?.endsWith(':RUNNING')).toBe(true);
    expect(notifications[1]?.endsWith(':SUCCEEDED')).toBe(true);
  });

  it('records attempt 0 failure -> retry scheduled/running -> retry success', async () => {
    const callCounter = { count: 0 };
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      swarmExecutor: createRetryingSwarmExecutor(callCounter)
    });

    const body = baseRequestBody();
    const response = await dispatchJson(dispatch, 'POST', '/run/swarm', body);
    expect(response.statusCode).toBe(200);
    expect((response.payload as { retryAttempted?: boolean }).retryAttempted).toBe(true);
    expect(callCounter.count).toBe(2);

    const run = response.payload as { runId: string };
    const db = getServiceDb(TEST_DB_PATH);
    const journal = createExecutionJournal(db);
    const events = journal.listRunEvents(run.runId);
    const transitions = events
      .filter((entry) => entry.eventType === 'STATE_TRANSITION')
      .map((entry) => `${entry.previousState}->${entry.nextState}`);
    expect(transitions).toEqual([
      'CREATED->RUNNING',
      'RUNNING->FAILED',
      'FAILED->RETRY_SCHEDULED',
      'RETRY_SCHEDULED->RETRY_RUNNING',
      'RETRY_RUNNING->RETRY_SUCCEEDED'
    ]);
  });

  it('duplicate retry request is idempotent and does not duplicate attempt 1 events', async () => {
    const callCounter = { count: 0 };
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      swarmExecutor: createRetryingSwarmExecutor(callCounter)
    });

    const runResponse = await dispatchJson(dispatch, 'POST', '/run/swarm', baseRequestBody());
    const run = runResponse.payload as { runId: string };

    const firstRetry = await dispatchJson(dispatch, 'POST', `/run/${run.runId}/retry`, {});
    const secondRetry = await dispatchJson(dispatch, 'POST', `/run/${run.runId}/retry`, {});
    expect(firstRetry.statusCode).toBe(200);
    expect(secondRetry.statusCode).toBe(200);
    expect(secondRetry.payload).toEqual({ accepted: true, attemptIndex: 1 });

    const db = getServiceDb(TEST_DB_PATH);
    const journal = createExecutionJournal(db);
    const attemptOneTransitions = journal.listRunEvents(run.runId).filter(
      (event) => event.attemptIndex === 1 && event.eventType === 'STATE_TRANSITION'
    );
    expect(attemptOneTransitions).toHaveLength(2);
  });

  it('rate limits POST /run/swarm and does not mutate runtime state when rejected', async () => {
    setRateLimitEnv({
      windowMs: 1_000,
      maxRequests: 1,
      slackActionMax: 1,
      runCreateMax: 1
    });

    const callCounter = { count: 0 };
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      swarmExecutor: createFakeSwarmExecutor(callCounter)
    });

    const first = await dispatchJson(dispatch, 'POST', '/run/swarm', baseRequestBody());
    const second = await dispatchJson(dispatch, 'POST', '/run/swarm', {
      ...baseRequestBody(),
      runIndex: 2
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.payload).toEqual({
      error: 'rate_limited',
      reasonCode: 'RATE_LIMIT_EXCEEDED'
    });
    expect(callCounter.count).toBe(1);

    const db = getServiceDb(TEST_DB_PATH);
    const runCount = db.prepare('SELECT COUNT(*) AS count FROM execution_runtime_runs').get() as { count: number };
    expect(runCount.count).toBe(1);
  });

  it('rate limit counter resets after window elapses', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    setRateLimitEnv({
      windowMs: 1_000,
      maxRequests: 1,
      slackActionMax: 1,
      runCreateMax: 1
    });

    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      swarmExecutor: createFakeSwarmExecutor({ count: 0 })
    });

    const first = await dispatchJson(dispatch, 'POST', '/run/swarm', baseRequestBody());
    const second = await dispatchJson(dispatch, 'POST', '/run/swarm', {
      ...baseRequestBody(),
      runIndex: 2
    });
    vi.advanceTimersByTime(1_001);
    const third = await dispatchJson(dispatch, 'POST', '/run/swarm', {
      ...baseRequestBody(),
      runIndex: 3
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(third.statusCode).toBe(200);
  });

  it('keeps deterministic envelope hash for sorted changed paths', () => {
    const envelope = buildEnvelopeIdentityV1({
      triggerType: 'manual',
      repo: { owner: 'smartfunds', name: 'sandbox' },
      ref: { base: 'main', head: 'feature/sprint-47' },
      changedPaths: ['b.ts', 'a.ts'],
      declaredTier: 3,
      impliedTier: 3,
      executionMode: 'structured'
    }, {
      loadProjects: () => [{ projectId: 'core-app', ownedPaths: ['**'] }],
      loadTeams: () => [{ teamId: 'dev-team', projectId: 'core-app', ownedPaths: ['**'] }],
      resolveOwnership: () => ({
        projectsTouched: ['core-app'],
        teamsTouched: ['dev-team'],
        unownedFiles: [],
        ownershipStatus: 'ok',
        nextActions: [],
        ambiguousOwnership: [],
        unownedDetails: []
      })
    });
    const first = computeEnvelopeHash(envelope);
    const second = computeEnvelopeHash(envelope);
    expect(first).toBe(second);
  });

  it('handles overlapping ownedPaths deterministically as ownership violation in envelope', () => {
    const envelope = buildEnvelopeIdentityV1({
      triggerType: 'manual',
      repo: { owner: 'smartfunds', name: 'sandbox' },
      ref: { base: 'main', head: 'feature/sprint-47' },
      changedPaths: ['packages/core/index.ts'],
      declaredTier: 3,
      impliedTier: 3,
      executionMode: 'structured'
    }, {
      loadProjects: () => [
        { projectId: 'wide', ownedPaths: ['packages/**'] },
        { projectId: 'narrow', ownedPaths: ['packages/core/**'] }
      ],
      loadTeams: () => [],
      resolveOwnership: () => ({
        projectsTouched: [],
        teamsTouched: [],
        unownedFiles: [],
        ownershipStatus: 'ambiguous_project_ownership',
        nextActions: [],
        ambiguousOwnership: [],
        unownedDetails: []
      })
    });

    expect(envelope.diff.ownershipStatus).toBe('violation');
    expect(envelope.diff.projectIdsTouched).toEqual([]);
    expect(envelope.diff.teamIdsTouched).toEqual([]);
  });

  it('slack retry action duplicate returns RETRY_ALREADY_CONSUMED and appends duplicate ignored journal event', async () => {
    const signingSecret = 'slack-secret';
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      slackSigningSecret: signingSecret,
      slackNowSeconds: () => 1700000000
    });
    const db = getServiceDb(TEST_DB_PATH);
    const runtimeService = createRuntimeService(createExecutionJournal(db));

    const envelopeIdentity = buildEnvelopeIdentityV1({
      triggerType: 'manual',
      repo: { owner: 'smartfunds', name: 'sandbox' },
      ref: { base: 'main', head: 'feature/sprint-48' },
      changedPaths: ['control-plane/service/index.ts'],
      declaredTier: 3,
      impliedTier: 3,
      executionMode: 'structured'
    }, {
      loadProjects: () => [{ projectId: 'core-app', ownedPaths: ['**'] }],
      loadTeams: () => [{ teamId: 'dev-team', projectId: 'core-app', ownedPaths: ['**'] }],
      resolveOwnership: () => ({
        projectsTouched: ['core-app'],
        teamsTouched: ['dev-team'],
        unownedFiles: [],
        ownershipStatus: 'ok',
        nextActions: [],
        ambiguousOwnership: [],
        unownedDetails: []
      })
    });
    const { runId, envelopeHash } = runtimeService.createOrGetRun(envelopeIdentity);
    const attempt0 = computeAttemptId(runId, 0);
    runtimeService.appendEvent(runId, attempt0, {
      eventType: 'STATE_TRANSITION',
      previousState: 'CREATED',
      nextState: 'RUNNING',
      envelopeHash
    });
    runtimeService.appendEvent(runId, attempt0, {
      eventType: 'STATE_TRANSITION',
      previousState: 'RUNNING',
      nextState: 'FAILED',
      envelopeHash,
      errorClass: 'LINT_FAILURE',
      failureSignature: 'sig-1'
    });

    const slackPayload = {
      type: 'block_actions',
      team: { id: 'T1' },
      user: { id: 'U1' },
      actions: [{ action_id: 'retry_run', value: `runId:${runId}` }],
      channel: { id: 'C1' },
      message: { ts: '123.456' }
    };
    const bodyText = new URLSearchParams({
      payload: JSON.stringify(slackPayload)
    }).toString();
    const timestamp = '1700000000';
    const headers = {
      'x-slack-signature': signSlack(signingSecret, timestamp, bodyText),
      'x-slack-request-timestamp': timestamp
    };

    const first = await dispatchRaw(dispatch, 'POST', '/webhooks/slack/actions', bodyText, headers);
    const second = await dispatchRaw(dispatch, 'POST', '/webhooks/slack/actions', bodyText, headers);

    expect(first.statusCode).toBe(200);
    expect(first.payload).toMatchObject({
      ok: true,
      status: 'retry_scheduled',
      attemptIndex: 1
    });
    expect(second.statusCode).toBe(200);
    expect(second.payload).toEqual({
      accepted: false,
      reasonCode: 'RETRY_ALREADY_CONSUMED'
    });

    const duplicateRows = db.prepare(`
      SELECT * FROM execution_journal
      WHERE type = 'WEBHOOK_DUPLICATE_IGNORED'
    `).all() as Array<{ ref_id: string }>;
    expect(duplicateRows).toHaveLength(1);
    expect(duplicateRows[0]?.ref_id.startsWith('slack:action:')).toBe(true);

    const transitions = createExecutionJournal(db)
      .listRunEvents(runId)
      .filter((event) => event.eventType === 'STATE_TRANSITION')
      .map((event) => `${event.previousState}->${event.nextState}`);
    expect(transitions).toEqual([
      'CREATED->RUNNING',
      'RUNNING->FAILED',
      'FAILED->RETRY_SCHEDULED',
      'RETRY_SCHEDULED->RETRY_RUNNING'
    ]);
  });

  it('slack retry action returns deterministic rejection when retry is not eligible', async () => {
    const signingSecret = 'slack-secret';
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      slackSigningSecret: signingSecret,
      slackNowSeconds: () => 1700000001
    });
    const db = getServiceDb(TEST_DB_PATH);
    const runtimeService = createRuntimeService(createExecutionJournal(db));

    const envelopeIdentity = buildEnvelopeIdentityV1({
      triggerType: 'manual',
      repo: { owner: 'smartfunds', name: 'sandbox' },
      ref: { base: 'main', head: 'feature/sprint-48' },
      changedPaths: ['control-plane/service/index.ts'],
      declaredTier: 3,
      impliedTier: 3,
      executionMode: 'structured'
    }, {
      loadProjects: () => [{ projectId: 'core-app', ownedPaths: ['**'] }],
      loadTeams: () => [{ teamId: 'dev-team', projectId: 'core-app', ownedPaths: ['**'] }],
      resolveOwnership: () => ({
        projectsTouched: ['core-app'],
        teamsTouched: ['dev-team'],
        unownedFiles: [],
        ownershipStatus: 'ok',
        nextActions: [],
        ambiguousOwnership: [],
        unownedDetails: []
      })
    });
    const { runId, envelopeHash } = runtimeService.createOrGetRun(envelopeIdentity);
    const attempt0 = computeAttemptId(runId, 0);
    runtimeService.appendEvent(runId, attempt0, {
      eventType: 'STATE_TRANSITION',
      previousState: 'CREATED',
      nextState: 'RUNNING',
      envelopeHash
    });
    runtimeService.appendEvent(runId, attempt0, {
      eventType: 'STATE_TRANSITION',
      previousState: 'RUNNING',
      nextState: 'FAILED',
      envelopeHash,
      errorClass: 'OWNERSHIP_VIOLATION',
      failureSignature: 'sig-2'
    });

    const slackPayload = {
      type: 'block_actions',
      team: { id: 'T1' },
      user: { id: 'U1' },
      actions: [{ action_id: 'retry_run', value: `runId:${runId}` }],
      channel: { id: 'C1' },
      message: { ts: '123.456' }
    };
    const bodyText = new URLSearchParams({
      payload: JSON.stringify(slackPayload)
    }).toString();
    const timestamp = '1700000001';
    const headers = {
      'x-slack-signature': signSlack(signingSecret, timestamp, bodyText),
      'x-slack-request-timestamp': timestamp
    };

    const response = await dispatchRaw(dispatch, 'POST', '/webhooks/slack/actions', bodyText, headers);
    expect(response.statusCode).toBe(200);
    expect(response.payload).toMatchObject({
      ok: true,
      status: 'rejected',
      reasonCode: 'NOT_ELIGIBLE'
    });
  });

  it('slack event duplicate appends WEBHOOK_DUPLICATE_IGNORED without lifecycle transitions', async () => {
    const signingSecret = 'slack-secret';
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      slackSigningSecret: signingSecret,
      slackNowSeconds: () => 1700000002
    });
    const db = getServiceDb(TEST_DB_PATH);

    const eventBody = JSON.stringify({
      type: 'event_callback',
      event_id: 'Ev123',
      team_id: 'T1',
      event: {
        type: 'reaction_added',
        user: 'U1',
        channel: 'C1',
        ts: '111.222'
      }
    });
    const timestamp = '1700000002';
    const headers = {
      'x-slack-signature': signSlack(signingSecret, timestamp, eventBody),
      'x-slack-request-timestamp': timestamp
    };

    const first = await dispatchRaw(dispatch, 'POST', '/webhooks/slack/events', eventBody, headers);
    const second = await dispatchRaw(dispatch, 'POST', '/webhooks/slack/events', eventBody, headers);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.payload).toMatchObject({ status: 'duplicate_ignored' });

    const duplicateRows = db.prepare(`
      SELECT * FROM execution_journal
      WHERE type = 'WEBHOOK_DUPLICATE_IGNORED'
    `).all();
    expect(duplicateRows).toHaveLength(1);

    const runtimeEvents = db.prepare('SELECT COUNT(*) AS count FROM execution_runtime_events').get() as { count: number };
    expect(runtimeEvents.count).toBe(0);
  });

  it('GET /audit/runs returns deterministic, entity-scoped, cursor-based listing', async () => {
    setRateLimitEnv({
      windowMs: 10_000,
      maxRequests: 100,
      slackActionMax: 100,
      runCreateMax: 100
    });

    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      swarmExecutor: createFakeSwarmExecutor({ count: 0 })
    });

    await dispatchJson(dispatch, 'POST', '/run/swarm', {
      ...baseRequestBody(),
      ref: { base: 'main', head: 'feature/a' }
    });
    await dispatchJson(dispatch, 'POST', '/run/swarm', {
      ...baseRequestBody(),
      ref: { base: 'main', head: 'feature/b' }
    });

    const firstPage = await dispatch({
      method: 'GET',
      pathname: '/audit/runs',
      bodyText: null,
      query: new URLSearchParams({
        entityId: 'core-entity',
        limit: '1'
      })
    });

    expect(firstPage.statusCode).toBe(200);
    const firstPayload = firstPage.payload as { cursor: string | null; items: Array<Record<string, unknown>> };
    expect(firstPayload.items).toHaveLength(1);
    expect(firstPayload.items[0]).toMatchObject({
      entityId: 'core-entity',
      projectId: 'core-app'
    });
    expect(Object.keys(firstPayload.items[0] ?? {}).sort((a, b) => a.localeCompare(b))).toEqual([
      'attemptCount',
      'entityId',
      'envelopeHash',
      'errorClass',
      'failureSignature',
      'projectId',
      'retryConsumed',
      'runId',
      'state',
      'swarmId'
    ]);

    const secondPage = await dispatch({
      method: 'GET',
      pathname: '/audit/runs',
      bodyText: null,
      query: new URLSearchParams({
        entityId: 'core-entity',
        limit: '10',
        cursor: firstPayload.cursor ?? ''
      })
    });

    const secondPayload = secondPage.payload as { items: Array<{ runId: string }> };
    expect(secondPage.statusCode).toBe(200);
    expect(secondPayload.items).toHaveLength(1);
    expect(secondPayload.items[0]?.runId.localeCompare((firstPayload.items[0] as { runId: string }).runId)).toBeGreaterThan(0);

    const filtered = await dispatch({
      method: 'GET',
      pathname: '/audit/runs',
      bodyText: null,
      query: new URLSearchParams({
        entityId: 'core-entity',
        state: 'FAILED'
      })
    });
    expect(filtered.statusCode).toBe(200);
    expect((filtered.payload as { items: unknown[] }).items).toHaveLength(0);
  });

  it('github webhook rejects missing signature with 401', async () => {
    const secret = 'github-secret';
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      githubWebhookSecret: secret
    });
    const bodyText = JSON.stringify({
      repository: { full_name: 'smartfunds/sandbox' },
      check_run: {
        name: 'Unit Tests',
        head_sha: 'abc123',
        conclusion: 'failure',
        pull_requests: [{ number: 42 }]
      }
    });

    const response = await dispatchRaw(dispatch, 'POST', '/webhooks/github', bodyText, {
      'content-type': 'application/json',
      'x-github-event': 'check_run',
      'x-github-delivery': 'delivery-1'
    });

    expect(response.statusCode).toBe(401);
    expect(response.payload).toEqual({ error: 'unauthorized: missing_signature' });
  });

  it('github webhook rejects invalid signature with 401', async () => {
    const secret = 'github-secret';
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      githubWebhookSecret: secret
    });
    const bodyText = JSON.stringify({
      repository: { full_name: 'smartfunds/sandbox' },
      check_run: {
        name: 'Unit Tests',
        head_sha: 'abc123',
        conclusion: 'failure',
        pull_requests: [{ number: 42 }]
      }
    });

    const response = await dispatchRaw(dispatch, 'POST', '/webhooks/github', bodyText, {
      'content-type': 'application/json',
      'x-github-event': 'check_run',
      'x-github-delivery': 'delivery-1',
      'x-hub-signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000'
    });

    expect(response.statusCode).toBe(401);
    expect(response.payload).toEqual({ error: 'unauthorized: invalid_signature' });
  });

  it('github webhook returns 204 for unsupported events', async () => {
    const secret = 'github-secret';
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      githubWebhookSecret: secret
    });
    const bodyText = JSON.stringify({ repository: { full_name: 'smartfunds/sandbox' } });

    const response = await dispatchRaw(dispatch, 'POST', '/webhooks/github', bodyText, {
      'content-type': 'application/json',
      'x-github-event': 'push',
      'x-hub-signature-256': signGithub(secret, bodyText)
    });

    expect(response.statusCode).toBe(204);
  });

  it('github webhook enforces content type', async () => {
    const secret = 'github-secret';
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      githubWebhookSecret: secret
    });
    const bodyText = JSON.stringify({
      repository: { full_name: 'smartfunds/sandbox' }
    });

    const response = await dispatchRaw(dispatch, 'POST', '/webhooks/github', bodyText, {
      'content-type': 'text/plain',
      'x-github-event': 'check_run',
      'x-github-delivery': 'delivery-1',
      'x-hub-signature-256': signGithub(secret, bodyText)
    });

    expect(response.statusCode).toBe(415);
    expect(response.payload).toEqual({ error: 'unsupported_media_type: expected_application_json' });
  });

  it('github webhook enforces body size limit', async () => {
    const secret = 'github-secret';
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      githubWebhookSecret: secret
    });
    const bodyText = JSON.stringify({
      payload: 'x'.repeat(1024 * 1024 + 32)
    });

    const response = await dispatchRaw(dispatch, 'POST', '/webhooks/github', bodyText, {
      'content-type': 'application/json',
      'x-github-event': 'check_run',
      'x-github-delivery': 'delivery-1',
      'x-hub-signature-256': signGithub(secret, bodyText)
    });

    expect(response.statusCode).toBe(413);
    expect(response.payload).toEqual({ error: 'payload_too_large' });
  });

  it('github webhook processes supported success event deterministically', async () => {
    const secret = 'github-secret';
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      githubWebhookSecret: secret
    });
    const bodyText = JSON.stringify({
      repository: { full_name: 'smartfunds/sandbox' },
      check_run: {
        name: 'Lint',
        head_sha: 'abc123',
        conclusion: 'success',
        pull_requests: [{ number: 42 }]
      }
    });

    const response = await dispatchRaw(dispatch, 'POST', '/webhooks/github', bodyText, {
      'content-type': 'application/json; charset=utf-8',
      'x-github-event': 'check_run',
      'x-github-delivery': 'delivery-success',
      'x-hub-signature-256': signGithub(secret, bodyText)
    });

    expect(response.statusCode).toBe(200);
    expect(response.payload).toMatchObject({
      ok: true,
      status: 'processed',
      retry: {
        accepted: false,
        reason: 'non_failure_conclusion'
      }
    });
  });

  it('github webhook dedupes repeated payload and does not retrigger retry callback path', async () => {
    const secret = 'github-secret';
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      githubWebhookSecret: secret,
      githubCiContextResolver: () => ({
        prNumber: 42,
        tier: 2,
        executionMode: 'structured',
        entityIds: [],
        railBindingStatus: 'ok',
        retryCount: 0,
        runId: 'missing-run'
      })
    });
    const bodyText = JSON.stringify({
      repository: { full_name: 'smartfunds/sandbox' },
      check_run: {
        name: 'Unit Tests',
        head_sha: 'abc123',
        conclusion: 'failure',
        pull_requests: [{ number: 42 }]
      }
    });
    const headers = {
      'content-type': 'application/json',
      'x-github-event': 'check_run',
      'x-github-delivery': 'delivery-dedupe',
      'x-hub-signature-256': signGithub(secret, bodyText)
    };

    const first = await dispatchRaw(dispatch, 'POST', '/webhooks/github', bodyText, headers);
    const second = await dispatchRaw(dispatch, 'POST', '/webhooks/github', bodyText, headers);

    expect(first.statusCode).toBe(200);
    expect((first.payload as { retry: { reason: string } }).retry.reason).toBe('RUN_NOT_FOUND');
    expect(second.statusCode).toBe(200);
    expect(second.payload).toMatchObject({
      status: 'duplicate_ignored',
      retry: {
        accepted: false,
        reason: 'duplicate_ignored'
      }
    });
  });
});
