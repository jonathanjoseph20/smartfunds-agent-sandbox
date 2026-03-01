import { createRequire } from 'node:module';

import { beforeEach, describe, expect, it } from 'vitest';

import { buildEnvelopeIdentityV1 } from './envelope.ts';
import { createExecutionJournal } from './journal.ts';
import { computeAttemptId } from './retry.ts';

const require = createRequire(import.meta.url);

type NodeSqliteModule = typeof import('node:sqlite');
type DatabaseSync = InstanceType<NodeSqliteModule['DatabaseSync']>;

function createInMemoryDb(): DatabaseSync {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-return
  const { DatabaseSync: SqliteDatabaseSync } = require('node:sqlite') as NodeSqliteModule;
  return new SqliteDatabaseSync(':memory:');
}

function envelope(changedPaths: string[]) {
  return buildEnvelopeIdentityV1({
    triggerType: 'manual',
    repo: { owner: 'smartfunds', name: 'sandbox' },
    ref: { base: 'main', head: 'feature/x' },
    changedPaths,
    declaredTier: 3,
    impliedTier: 3,
    executionMode: 'structured'
  }, {
    loadProjects: () => [{ projectId: 'core-app', ownedPaths: ['control-plane/**'] }],
    loadTeams: () => [{ teamId: 'dev-team', projectId: 'core-app', ownedPaths: ['control-plane/**'] }],
    resolveOwnership: () => ({
      projectsTouched: ['core-app'],
      teamsTouched: ['dev-team'],
      unownedFiles: [],
      ownershipStatus: 'ok',
      nextActions: []
    })
  });
}

describe('execution journal', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createInMemoryDb();
  });

  it('createOrGetRun is idempotent for identical envelope hash', () => {
    const journal = createExecutionJournal(db);
    const first = journal.createOrGetRun(envelope(['control-plane/service/index.ts']));
    const second = journal.createOrGetRun(envelope(['control-plane/service/index.ts']));

    expect(first).toEqual(second);
    expect(journal.listRuns()).toHaveLength(1);
  });

  it('assigns stable monotonic eventIndex and keeps append-only ordering', () => {
    const journal = createExecutionJournal(db);
    const run = journal.createOrGetRun(envelope(['control-plane/service/index.ts']));
    const attempt0 = computeAttemptId(run.runId, 0);

    const firstIndex = journal.appendEvent(run.runId, attempt0, {
      eventType: 'STATE_TRANSITION',
      previousState: 'CREATED',
      nextState: 'RUNNING',
      envelopeHash: run.envelopeHash
    });
    const secondIndex = journal.appendEvent(run.runId, attempt0, {
      eventType: 'ERROR_CLASSIFIED',
      envelopeHash: run.envelopeHash,
      errorClass: 'LINT_FAILURE',
      failureSignature: 'sig-1'
    });

    expect(firstIndex).toBe(0);
    expect(secondIndex).toBe(1);
    expect(journal.listRunEvents(run.runId).map((event) => event.eventIndex)).toEqual([0, 1]);
  });

  it('dedupes artifact links by attemptId+artifactType+artifactValue', () => {
    const journal = createExecutionJournal(db);
    const run = journal.createOrGetRun(envelope(['control-plane/service/index.ts']));
    const attempt0 = computeAttemptId(run.runId, 0);
    journal.appendEvent(run.runId, attempt0, {
      eventType: 'STATE_TRANSITION',
      previousState: 'CREATED',
      nextState: 'RUNNING',
      envelopeHash: run.envelopeHash
    });

    const first = journal.appendEvent(run.runId, attempt0, {
      eventType: 'ARTIFACT_LINKED',
      envelopeHash: run.envelopeHash,
      artifactType: 'pr_url',
      artifactValue: 'https://example.test/pr/1'
    });
    const second = journal.appendEvent(run.runId, attempt0, {
      eventType: 'ARTIFACT_LINKED',
      envelopeHash: run.envelopeHash,
      artifactType: 'pr_url',
      artifactValue: 'https://example.test/pr/1'
    });

    expect(first).toBe(second);
    expect(journal.listRunEvents(run.runId).filter((event) => event.eventType === 'ARTIFACT_LINKED')).toHaveLength(1);
  });
});
