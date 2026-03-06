import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createExecutionJournal } from './journal.ts';

vi.mock('../studio/registry.ts', () => ({
  loadOwnershipProjects: () => [
    {
      projectId: 'control-plane',
      entityId: 'core-entity',
      podId: 'smartfunds',
      mode: 'structured',
      ownedPaths: ['control-plane/**']
    }
  ]
}));

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-journal-runtime');

beforeEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution journal', () => {
  it('creates run with canonical registry context and deterministic run IDs', () => {
    const journal = createExecutionJournal({ rootDir: tmpRoot });

    const first = journal.createRun({
      projectId: 'control-plane',
      kind: 'governance',
      entrypoint: 'governance:preflight'
    });
    const second = journal.createRun({
      projectId: 'control-plane',
      kind: 'governance',
      entrypoint: 'governance:preflight'
    });

    expect(first.entity).toBe('core-entity');
    expect(first.pod).toBe('smartfunds');
    expect(first.mode).toBe('structured');
    expect(first.runId).toBe('run_control-plane_0001');
    expect(second.runId).toBe('run_control-plane_0002');
  });

  it('rejects unknown projects', () => {
    const journal = createExecutionJournal({ rootDir: tmpRoot });

    expect(() => journal.createRun({
      projectId: 'unknown-project',
      kind: 'governance',
      entrypoint: 'governance:preflight'
    })).toThrow(/Unknown project/);
  });

  it('appends events and generates deterministic artifact IDs', () => {
    const journal = createExecutionJournal({ rootDir: tmpRoot });
    const run = journal.createRun({
      projectId: 'control-plane',
      kind: 'governance',
      entrypoint: 'governance:preflight'
    });

    const firstEvent = journal.appendEvent({
      runId: run.runId,
      type: 'TASK_COMPLETED',
      phase: 'implement',
      taskId: 'task-1',
      payload: { ok: true }
    });
    const secondEvent = journal.appendEvent({
      runId: run.runId,
      type: 'ARTIFACT_RECORDED',
      phase: 'release',
      taskId: 'task-1',
      payload: { kind: 'manifest', path: 'runtime-data/file.json' }
    });

    expect(firstEvent.sequence).toBe(1);
    expect(secondEvent.sequence).toBe(2);
    expect(secondEvent.artifactId).toBe(`art_${run.runId}_0002`);
  });

  it('returns full inspect payload and reducer-derived summary', () => {
    const journal = createExecutionJournal({ rootDir: tmpRoot });
    const run = journal.createRun({
      projectId: 'control-plane',
      kind: 'governance',
      entrypoint: 'governance:preflight'
    });

    journal.appendEvent({ runId: run.runId, type: 'PHASE_STARTED', phase: 'plan', payload: {} });
    journal.appendEvent({ runId: run.runId, type: 'TASK_FAILED', phase: 'verify', taskId: 'task-2', payload: {} });

    const inspected = journal.inspectRun(run.runId);
    const summary = journal.summarizeRun(run.runId);

    expect(inspected.run.runId).toBe(run.runId);
    expect(inspected.events).toHaveLength(2);
    expect(summary.status).toBe('running');
    expect(summary.tasksFailed).toBe(1);
  });
});
