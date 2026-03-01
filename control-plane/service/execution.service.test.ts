import { describe, expect, it, beforeEach } from 'vitest';

import { buildEnvelopeIdentityV1, computeEnvelopeHash } from '../execution/envelope.ts';
import { createExecutionJournal } from '../execution/journal.ts';
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
  body: unknown
) {
  return dispatch({
    method,
    pathname,
    bodyText: body === null ? null : JSON.stringify(body)
  });
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
});
