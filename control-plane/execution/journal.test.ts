import { createRequire } from 'node:module';

import { beforeEach, describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { createExecutionJournal, computeExecutionEventId } from './journal.ts';

const require = createRequire(import.meta.url);

type NodeSqliteModule = typeof import('node:sqlite');
type DatabaseSync = InstanceType<NodeSqliteModule['DatabaseSync']>;

function createInMemoryDb(): DatabaseSync {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-return
  const { DatabaseSync: SqliteDatabaseSync } = require('node:sqlite') as NodeSqliteModule;
  return new SqliteDatabaseSync(':memory:');
}

describe('execution journal', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createInMemoryDb();
  });

  it('generates deterministic event_id from run-state-attempt-payloadHash', () => {
    const payloadCanonical = canonicalStringify({ ok: true });
    const payloadHash = sha256(payloadCanonical);
    const first = computeExecutionEventId('run-1', 'VALIDATED', 0, payloadHash);
    const second = computeExecutionEventId('run-1', 'VALIDATED', 0, payloadHash);

    expect(first).toBe(second);
  });

  it('keeps append-only event ordering', () => {
    const journal = createExecutionJournal(db, () => '2026-03-01T00:00:00.000Z');
    const created = journal.createRun({
      runType: 'swarm',
      projectId: 'core-app',
      swarmId: 'dev-team',
      mode: 'structured',
      runIndex: 1,
      intent: 'run sprint',
      branchName: 'swarm/core-app/dev-team/run-1'
    });

    journal.appendRunEvent(created.runId, 'VALIDATED', { step: 1 });
    journal.appendRunEvent(created.runId, 'COMMITTED', { step: 2 });

    const events = journal.listRunEvents(created.runId);
    expect(events.map((event) => event.state)).toEqual(['CREATED', 'VALIDATED', 'COMMITTED']);
  });

  it('produces stable result hash from canonical result', () => {
    const journal = createExecutionJournal(db, () => '2026-03-01T00:00:00.000Z');
    const created = journal.createRun({
      runType: 'swarm',
      projectId: 'core-app',
      swarmId: 'dev-team',
      mode: 'structured',
      runIndex: 1,
      intent: 'run sprint',
      branchName: 'swarm/core-app/dev-team/run-1'
    });

    const result = {
      ok: true,
      code: 'OK',
      projectId: 'core-app',
      swarmId: 'dev-team',
      executionMode: 'structured',
      runId: 'abc',
      branchName: 'swarm/core-app/dev-team/run-1',
      mutatedFiles: ['control-plane/swarms/dev-team/run-1.txt'],
      reportHash: 'hash'
    };

    journal.setRunResult(created.runId, result);
    const stored = journal.getRun(created.runId);

    expect(stored?.resultCanonical).toBe(canonicalStringify(result));
    expect(stored?.resultHash).toBe(sha256(canonicalStringify(result)));
  });

  it('createRun is idempotent for the same deterministic args', () => {
    const journal = createExecutionJournal(db, () => '2026-03-01T00:00:00.000Z');
    const input = {
      runType: 'swarm' as const,
      projectId: 'core-app',
      swarmId: 'dev-team',
      mode: 'structured' as const,
      runIndex: 1,
      intent: 'run sprint',
      branchName: 'swarm/core-app/dev-team/run-1'
    };

    const first = journal.createRun(input);
    const second = journal.createRun(input);

    expect(second.runId).toBe(first.runId);
    expect(journal.listRuns()).toHaveLength(1);
    expect(journal.listRunEvents(first.runId).filter((event) => event.state === 'CREATED')).toHaveLength(1);
  });

  it('listRuns sorts lexicographically by run_id', () => {
    const journal = createExecutionJournal(db, () => '2026-03-01T00:00:00.000Z');

    journal.createRun({
      runType: 'swarm',
      projectId: 'project-b',
      swarmId: 'swarm-b',
      mode: 'structured',
      runIndex: 2,
      intent: 'b',
      branchName: 'swarm/project-b/swarm-b/run-2'
    });

    journal.createRun({
      runType: 'swarm',
      projectId: 'project-a',
      swarmId: 'swarm-a',
      mode: 'structured',
      runIndex: 1,
      intent: 'a',
      branchName: 'swarm/project-a/swarm-a/run-1'
    });

    const runs = journal.listRuns();
    const runIds = runs.map((run) => run.runId);

    expect(runIds).toEqual([...runIds].sort((left, right) => left.localeCompare(right)));
  });
});
