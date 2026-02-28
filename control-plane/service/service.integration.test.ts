import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { runSwarmExecution } from '../swarms/swarmExecutor.ts';
import { createServiceDispatcher } from './index.ts';
import type { ServiceDispatchResponse } from './index.ts';
import { resolveHandlerRoute } from './handlers/router.ts';
import { clearServiceDbRegistryForTests, getServiceDb } from './storage/db.ts';
import { computeEventId, getEventById } from './storage/events.ts';
import { countJournalByRefId, computeSwarmRunId, getJournalByRunId } from './storage/journal.ts';
import { computeTaskId, getTaskById } from './storage/tasks.ts';

const TEST_ADAPTER_KEY = '__SMARTFUNDS_SWARM_EXECUTION_ADAPTER__';
const TEST_DB_PATH = ':memory:';

interface TestAdapter {
  branchExistsLocal: (branchName: string) => boolean;
  branchExistsRemote: (branchName: string) => boolean;
  checkoutNewBranch: (branchName: string) => void;
  stageFile: (filePath: string) => void;
  commit: (message: string) => void;
  pushBranch: (branchName: string) => void;
  createPullRequest: (params: { base: string; head: string; title: string; body: string; labels: string[] }) => { prCreated: boolean };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createFixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'service-runtime-'));

  writeJson(path.join(root, 'control-plane/projects/core-app.json'), {
    projectId: 'core-app',
    ownedPaths: ['control-plane/swarms/runtime-artifacts/core-app/**']
  });

  writeJson(path.join(root, 'control-plane/teams/dev-team.json'), {
    teamId: 'dev-team',
    projectId: 'core-app',
    executionMode: 'structured',
    ownedPaths: ['control-plane/swarms/runtime-artifacts/core-app/**']
  });

  writeJson(path.join(root, 'control-plane/swarms/dev-team.json'), {
    swarmId: 'dev-team',
    project: 'core-app',
    team: 'dev-team',
    executionMode: 'structured'
  });

  writeJson(path.join(root, 'control-plane/entities/registry.json'), [
    {
      entityId: 'core-app-entity',
      legalName: 'Core App Entity',
      projects: ['core-app'],
      complianceProfile: 'phase-1',
      custodyMode: 'non_custodial'
    }
  ]);

  writeJson(path.join(root, 'control-plane/entities/rails.json'), {
    version: 1,
    entities: [
      {
        entityId: 'core-app-entity',
        railProfile: 'structured-only'
      }
    ]
  });

  return root;
}

function createAdapter(): TestAdapter {
  const localBranches = new Set<string>();
  const remoteBranches = new Set<string>();

  return {
    branchExistsLocal: (branchName) => localBranches.has(branchName),
    branchExistsRemote: (branchName) => remoteBranches.has(branchName),
    checkoutNewBranch: (branchName) => {
      localBranches.add(branchName);
    },
    stageFile: () => {
      // no-op
    },
    commit: () => {
      // no-op
    },
    pushBranch: (branchName) => {
      remoteBranches.add(branchName);
    },
    createPullRequest: () => {
      return { prCreated: true };
    }
  };
}

describe.sequential('service integration', () => {
  let previousCwd = '';
  let fixtureRoot = '';
  let dispatch: ((method: string, pathname: string, body: unknown) => Promise<ServiceDispatchResponse>) | null = null;

  beforeEach(() => {
    clearServiceDbRegistryForTests();
    fixtureRoot = createFixtureRoot();
    previousCwd = process.cwd();
    process.chdir(fixtureRoot);
    (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY] = createAdapter();

    const runtimeDispatch = createServiceDispatcher({ dbPath: TEST_DB_PATH, now: () => '2026-02-28T00:00:00.000Z' });
    dispatch = (method, pathname, body) => runtimeDispatch({
      method,
      pathname,
      bodyText: body === null ? null : JSON.stringify(body)
    });
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY];
    process.chdir(previousCwd);
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    clearServiceDbRegistryForTests();
    dispatch = null;
  });

  it('POST /execute returns executor result unchanged and writes deterministic journal row', async () => {
    const executeInput = {
      swarmId: 'dev-team',
      projectId: 'core-app',
      mode: 'structured',
      intent: 'sprint-42-runtime'
    };

    const serviceResponse = await dispatch?.('POST', '/execute', executeInput);
    expect(serviceResponse?.statusCode).toBe(200);

    const expectedFixture = createFixtureRoot();
    const previous = process.cwd();
    process.chdir(expectedFixture);
    (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY] = createAdapter();
    const direct = await runSwarmExecution({
      swarmId: executeInput.swarmId,
      projectId: executeInput.projectId,
      executionMode: executeInput.mode,
      taskIntent: executeInput.intent
    });
    delete (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY];
    process.chdir(previous);
    fs.rmSync(expectedFixture, { recursive: true, force: true });

    expect(serviceResponse?.payload).toEqual(direct);

    const canonicalResult = canonicalStringify(serviceResponse?.payload);
    const expectedRunId = computeSwarmRunId(canonicalResult);
    const db = getServiceDb(TEST_DB_PATH);
    const journal = getJournalByRunId(db, expectedRunId);

    expect(journal).not.toBeNull();
    expect(journal?.type).toBe('swarm_execute');
    expect(journal?.ref_id).toBe('swarm/dev-team/run-1');
    expect(journal?.result_hash).toBe((serviceResponse?.payload as { deterministicHash: string }).deterministicHash);
  });

  it('POST /webhooks/test persists deterministic event/task and enforces idempotency', async () => {
    const firstPayload = {
      alpha: 1,
      nested: {
        b: true,
        a: 'x'
      }
    };

    const first = await dispatch?.('POST', '/webhooks/test', firstPayload);
    expect(first?.statusCode).toBe(200);

    const canonicalPayload = canonicalStringify(firstPayload);
    const eventId = computeEventId('test', canonicalPayload);
    const route = resolveHandlerRoute('test');
    expect(route).not.toBeNull();

    const taskId = computeTaskId(eventId, route?.handlerName ?? 'TestHandler', 0);
    const db = getServiceDb(TEST_DB_PATH);

    const eventRow = getEventById(db, eventId);
    const taskRow = getTaskById(db, taskId);

    expect(eventRow).not.toBeNull();
    expect(eventRow?.status).toBe('processed');
    expect(taskRow).not.toBeNull();
    expect(taskRow?.status).toBe('done');
    expect(taskRow?.result_canonical).toBe(canonicalStringify(first?.payload));
    expect(countJournalByRefId(db, eventId)).toBe(1);

    const secondPayload = {
      nested: {
        a: 'x',
        b: true
      },
      alpha: 1
    };

    const second = await dispatch?.('POST', '/webhooks/test', secondPayload);
    expect(second?.statusCode).toBe(200);
    expect(second?.payload).toEqual({
      ok: true,
      code: 'idempotent_replay',
      summaryCanonical: canonicalStringify({
        source: 'test',
        event_id: eventId,
        status: 'processed',
        message: 'duplicate_ignored'
      })
    });

    expect(countJournalByRefId(db, eventId)).toBe(1);
    expect(getEventById(db, eventId)?.event_id).toBe(eventId);
    expect(getTaskById(db, taskId)?.task_id).toBe(taskId);
  });

  it('produces identical IDs for repeated identical logical webhook input', () => {
    const payloadA = { z: 1, a: { x: 2, y: 3 } };
    const payloadB = { a: { y: 3, x: 2 }, z: 1 };

    const canonicalA = canonicalStringify(payloadA);
    const canonicalB = canonicalStringify(payloadB);

    const eventIdA = computeEventId('test', canonicalA);
    const eventIdB = computeEventId('test', canonicalB);
    expect(eventIdA).toBe(eventIdB);

    const taskIdA = computeTaskId(eventIdA, 'TestHandler', 0);
    const taskIdB = computeTaskId(eventIdB, 'TestHandler', 0);
    expect(taskIdA).toBe(taskIdB);

    const canonicalResult = canonicalStringify({ ok: true, code: 'stub_ok', summaryCanonical: canonicalStringify({ event_id: eventIdA }) });
    const runIdA = sha256(`event_ingest\ntest\n${eventIdA}\n${canonicalResult}`);
    const runIdB = sha256(`event_ingest\ntest\n${eventIdB}\n${canonicalResult}`);
    expect(runIdA).toBe(runIdB);
  });
});
