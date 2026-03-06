import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createJournalStorage } from './storage.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-journal-storage');

function resetTmp(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
}

beforeEach(() => {
  resetTmp();
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('journal storage', () => {
  it('writes deterministic run and event JSON output', () => {
    const storage = createJournalStorage({ rootDir: tmpRoot });
    const run = storage.createRun({
      projectId: 'control-plane',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'governance',
      entrypoint: 'governance:preflight'
    });

    const event = storage.appendEvent(run.runId, {
      sequence: 1,
      type: 'PHASE_STARTED',
      phase: 'plan',
      payload: { b: 2, a: 1 }
    });

    expect(event.eventId).toBe(`evt_${run.runId}_0001`);

    const runFile = fs.readFileSync(path.join(tmpRoot, 'runs', `${run.runId}.json`), 'utf8');
    const eventsFile = fs.readFileSync(path.join(tmpRoot, 'events', `${run.runId}.json`), 'utf8');

    expect(runFile.endsWith('\n')).toBe(true);
    expect(eventsFile.endsWith('\n')).toBe(true);
    expect(runFile).toContain('"createdIndex":1');
    expect(eventsFile).toContain('"payload":{"a":1,"b":2}');
  });

  it('rejects duplicate sequence or sequence gaps', () => {
    const storage = createJournalStorage({ rootDir: tmpRoot });
    const run = storage.createRun({
      projectId: 'control-plane',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'governance',
      entrypoint: 'governance:preflight'
    });

    storage.appendEvent(run.runId, {
      sequence: 1,
      type: 'PHASE_STARTED',
      phase: 'plan',
      payload: {}
    });

    expect(() => storage.appendEvent(run.runId, {
      sequence: 1,
      type: 'TASK_STARTED',
      phase: 'plan',
      payload: {}
    })).toThrow(/expected 2, received 1/);

    expect(() => storage.appendEvent(run.runId, {
      sequence: 3,
      type: 'TASK_STARTED',
      phase: 'plan',
      payload: {}
    })).toThrow(/expected 2, received 3/);
  });

  it('lists runs deterministically and increments run IDs per project', () => {
    const storage = createJournalStorage({ rootDir: tmpRoot });
    const second = storage.createRun({
      projectId: 'other',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'governance',
      entrypoint: 'cmd2'
    });
    const first = storage.createRun({
      projectId: 'control-plane',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'governance',
      entrypoint: 'cmd1'
    });
    const third = storage.createRun({
      projectId: 'control-plane',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'governance',
      entrypoint: 'cmd3'
    });

    expect(second.runId).toBe('run_other_0001');
    expect(first.runId).toBe('run_control-plane_0001');
    expect(third.runId).toBe('run_control-plane_0002');

    expect(storage.listRuns().map((run) => run.createdIndex)).toEqual([1, 2, 3]);
  });

  it('rejects invalid run for append/getEvents/getSummary', () => {
    const storage = createJournalStorage({ rootDir: tmpRoot });

    expect(() => storage.appendEvent('run_unknown_0001', {
      sequence: 1,
      type: 'PHASE_STARTED',
      phase: 'plan',
      payload: {}
    })).toThrow(/Run not found/);

    expect(() => storage.getEvents('run_unknown_0001')).toThrow(/Run not found/);
    expect(() => storage.getSummary('run_unknown_0001')).toThrow(/Run not found/);
  });
});
