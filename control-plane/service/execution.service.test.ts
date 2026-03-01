import { describe, expect, it, beforeEach } from 'vitest';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { createServiceDispatcher } from './index.ts';
import { clearServiceDbRegistryForTests, getServiceDb } from './storage/db.ts';
import { createExecutionJournal } from '../execution/journal.ts';
import type { SwarmExecutionArgs, SwarmExecutionResult } from '../swarm/types.ts';
import type { SwarmExecutorOptions } from '../swarm/swarm-executor.ts';

const TEST_DB_PATH = ':memory:';
const FIXED_NOW = '2026-03-01T00:00:00.000Z';

function createFakeSwarmExecutor(callCounter: { count: number }) {
  return (args: SwarmExecutionArgs, options: SwarmExecutorOptions = {}): SwarmExecutionResult => {
    callCounter.count += 1;

    options.hooks?.onState?.('VALIDATED', { runIndex: args.runIndex ?? 1 });
    options.hooks?.onState?.('BRANCH_CREATED', { branchName: `swarm/${args.projectId}/${args.swarmId}/run-${args.runIndex ?? 1}` });
    options.hooks?.onState?.('PATCH_APPLIED', { file: 'control-plane/swarms/dev-team/run-1.txt' });
    options.hooks?.onState?.('COMMITTED', { commit: 'deterministic' });
    options.hooks?.onState?.('PUSHED', { remote: 'origin' });
    options.hooks?.onState?.('PR_OPENED', { prNumber: 7, prUrl: 'https://example.test/repo/pull/7' });
    options.hooks?.onState?.('COMPLETED', { result: 'ok' });

    const runId = sha256(canonicalStringify({
      projectId: args.projectId,
      swarmId: args.swarmId,
      executionMode: args.executionMode,
      intent: args.intent,
      runIndex: args.runIndex ?? 1
    }));

    return {
      ok: true,
      code: 'OK',
      projectId: args.projectId,
      swarmId: args.swarmId,
      executionMode: args.executionMode,
      runId,
      branchName: `swarm/${args.projectId}/${args.swarmId}/run-${args.runIndex ?? 1}`,
      prNumber: 7,
      prUrl: 'https://example.test/repo/pull/7',
      appliedPatchId: 'patch-1',
      mutatedFiles: ['control-plane/swarms/dev-team/run-1.txt'],
      reportHash: sha256(canonicalStringify({ ok: true, args }))
    };
  };
}

async function dispatchJson(
  dispatch: ReturnType<typeof createServiceDispatcher>,
  method: string,
  pathname: string,
  body: unknown,
  query?: URLSearchParams
) {
  return dispatch({
    method,
    pathname,
    bodyText: body === null ? null : JSON.stringify(body),
    ...(query ? { query } : {})
  });
}

describe.sequential('execution service unit', () => {
  beforeEach(() => {
    clearServiceDbRegistryForTests();
  });

  it('validates /run/swarm request schema', async () => {
    const callCounter = { count: 0 };
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      now: () => FIXED_NOW,
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

  it('returns deterministic run payload and keeps replay idempotent', async () => {
    const callCounter = { count: 0 };
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      now: () => FIXED_NOW,
      swarmExecutor: createFakeSwarmExecutor(callCounter)
    });

    const requestBody = {
      projectId: 'core-app',
      swarmId: 'dev-team',
      mode: 'structured' as const,
      intent: 'sprint-45',
      runIndex: 1
    };

    const first = await dispatchJson(dispatch, 'POST', '/run/swarm', requestBody);
    const second = await dispatchJson(dispatch, 'POST', '/run/swarm', requestBody);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(canonicalStringify(first.payload)).toBe(canonicalStringify(second.payload));
    expect(callCounter.count).toBe(1);

    const firstRun = first.payload as { runId: string };
    const secondRun = second.payload as { runId: string };
    expect(firstRun.runId).toBe(secondRun.runId);
  });
});

describe.sequential('execution service integration', () => {
  beforeEach(() => {
    clearServiceDbRegistryForTests();
  });

  it('records ordered states and stable result hash and avoids duplicate events on replay', async () => {
    const callCounter = { count: 0 };
    const dispatch = createServiceDispatcher({
      dbPath: TEST_DB_PATH,
      now: () => FIXED_NOW,
      swarmExecutor: createFakeSwarmExecutor(callCounter)
    });

    const requestBody = {
      projectId: 'core-app',
      swarmId: 'dev-team',
      mode: 'structured' as const,
      intent: 'sprint-45-integration',
      runIndex: 1
    };

    const response = await dispatchJson(dispatch, 'POST', '/run/swarm', requestBody);
    expect(response.statusCode).toBe(200);

    const run = response.payload as { runId: string; resultHash: string; resultCanonical: string };
    expect(run.runId).toBeTypeOf('string');
    expect(run.resultHash).toBe(sha256(run.resultCanonical));

    const getRunResponse = await dispatchJson(dispatch, 'GET', `/run/${run.runId}`, null);
    expect(getRunResponse.statusCode).toBe(200);

    const listResponse = await dispatchJson(
      dispatch,
      'GET',
      '/runs',
      null,
      new URLSearchParams({ projectId: 'core-app', swarmId: 'dev-team' })
    );
    expect(listResponse.statusCode).toBe(200);
    expect((listResponse.payload as { runs: unknown[] }).runs).toHaveLength(1);

    const db = getServiceDb(TEST_DB_PATH);
    const journal = createExecutionJournal(db, () => FIXED_NOW);
    const events = journal.listRunEvents(run.runId);

    expect(events.map((event) => event.state)).toEqual([
      'CREATED',
      'VALIDATED',
      'BRANCH_CREATED',
      'PATCH_APPLIED',
      'COMMITTED',
      'PUSHED',
      'PR_OPENED',
      'COMPLETED'
    ]);

    const replay = await dispatchJson(dispatch, 'POST', '/run/swarm', requestBody);
    expect(replay.statusCode).toBe(200);
    expect(callCounter.count).toBe(1);

    const eventsAfterReplay = journal.listRunEvents(run.runId);
    expect(eventsAfterReplay).toHaveLength(events.length);
  });
});
