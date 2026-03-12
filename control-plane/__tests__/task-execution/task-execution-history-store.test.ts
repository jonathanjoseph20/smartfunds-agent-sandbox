import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { deriveTaskExecutionEventDedupeKey } from '../../task-execution/task-execution-step-identity.ts';
import { createTaskExecutionHistoryStore } from '../../task-execution/task-execution-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-execution-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task execution history store', () => {
  it('T-MTE-H1 append-only behavior and dedupe are deterministic', () => {
    const store = createTaskExecutionHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      taskGraphId: 'tg-1',
      eventType: 'node_execution_started',
      eventPayload: { taskNodeId: 'node-a' },
    });

    const second = store.append({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      taskGraphId: 'tg-1',
      eventType: 'node_execution_started',
      eventPayload: { taskNodeId: 'node-a' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MTE-H2 event ordering and repeated load are stable', () => {
    const store = createTaskExecutionHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      taskGraphId: 'tg-1',
      eventType: 'node_execution_started',
      eventPayload: { taskNodeId: 'node-a' },
    });

    store.append({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      taskGraphId: 'tg-1',
      eventType: 'node_execution_completed',
      eventPayload: { taskNodeId: 'node-a' },
    });

    const first = store.load({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      taskGraphId: 'tg-1',
    });

    const second = store.load({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      taskGraphId: 'tg-1',
    });

    expect(second).toEqual(first);
    expect(first.entries.map((entry) => entry.eventIndex)).toEqual([0, 1]);
  });

  it('T-MTE-H3 event dedupe key is deterministic', () => {
    const keyInput = {
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      taskGraphId: 'tg-1',
      eventType: 'graph_execution_progressed' as const,
      eventPayload: {
        completedNodeCount: 1,
        totalNodeCount: 2,
      },
    };

    expect(deriveTaskExecutionEventDedupeKey(keyInput)).toBe(deriveTaskExecutionEventDedupeKey(keyInput));
  });
});
