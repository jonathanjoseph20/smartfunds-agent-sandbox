import { createHmac } from 'node:crypto';

import { describe, expect, it, beforeEach } from 'vitest';

import { buildEnvelopeIdentityV1, computeEnvelopeHash } from '../execution/envelope.ts';
import { createExecutionJournal } from '../execution/journal.ts';
import { computeAttemptId } from '../execution/retry.ts';
import { createRuntimeService } from '../execution/runtime-service.ts';
import { createServiceDispatcher } from './index.ts';
import { clearServiceDbRegistryForTests, getServiceDb } from './storage/db.ts';
import type { SwarmExecutionArgs, SwarmExecutionResult } from '../swarm/types.ts';
import type { SwarmExecutorOptions } from '../swarm/swarm-executor.ts';

const TEST_DB_PATH = ':memory:';

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

describe.sequential('execution service unit', () => {
  beforeEach(() => {
    clearServiceDbRegistryForTests();
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
});

describe.sequential('execution service integration', () => {
  beforeEach(() => {
    clearServiceDbRegistryForTests();
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
        nextActions: []
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
        nextActions: []
      })
    });

    expect(envelope.diff.ownershipStatus).toBe('violation');
    expect(envelope.diff.projectIdsTouched).toEqual([]);
    expect(envelope.diff.teamIdsTouched).toEqual([]);
  });

  it('slack retry action is idempotent and duplicate request is ignored', async () => {
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
        nextActions: []
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
    expect(second.payload).toMatchObject({
      ok: true,
      status: 'duplicate_ignored'
    });
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
        nextActions: []
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
});
