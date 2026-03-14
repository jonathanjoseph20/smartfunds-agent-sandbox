import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createBuildExecutionHistoryStore } from '../../build-runtime/build-execution-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'build-runtime', 'tmp-build-execution-history');
const historyFilePath = path.join(tmpRoot, 'history.json');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('build execution history store', () => {
  it('T-PF6-H1 append-only, deterministic ordering, payload-hash dedupe, and replay stability', () => {
    const store = createBuildExecutionHistoryStore({ historyFilePath });

    const first = store.appendBuildExecutionEvent({
      runId: 'run-1',
      eventType: 'build_execution_created',
      payloadHash: 'aaa',
      payload: { runId: 'run-1' },
    });

    const duplicate = store.appendBuildExecutionEvent({
      runId: 'run-1',
      eventType: 'build_execution_created',
      payloadHash: 'aaa',
      payload: { runId: 'run-1' },
    });

    const second = store.appendBuildExecutionEvent({
      runId: 'run-1',
      eventType: 'build_execution_started',
      payloadHash: 'bbb',
      payload: { runId: 'run-1' },
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    expect(store.listBuildExecutionEvents('run-1')).toEqual([
      {
        runId: 'run-1',
        eventType: 'build_execution_created',
        payloadHash: 'aaa',
        payload: { runId: 'run-1' },
      },
      {
        runId: 'run-1',
        eventType: 'build_execution_started',
        payloadHash: 'bbb',
        payload: { runId: 'run-1' },
      },
    ]);

    const reloaded = createBuildExecutionHistoryStore({ historyFilePath });
    expect(reloaded.listBuildExecutionEvents('run-1')).toEqual(store.listBuildExecutionEvents('run-1'));
  });
});
