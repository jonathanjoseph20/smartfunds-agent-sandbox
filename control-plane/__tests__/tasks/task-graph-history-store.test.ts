import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createImplementationTaskGraphHistoryStore } from '../../tasks/task-graph-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tasks', 'tmp-task-graph-history');
const historyFilePath = path.join(tmpRoot, 'history.json');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('implementation task graph history store', () => {
  it('T-PF3-H1 appends deterministically and dedupes identical events', () => {
    const store = createImplementationTaskGraphHistoryStore({ historyFilePath });

    const first = store.appendImplementationTaskGraphEvent({
      eventType: 'implementation_task_graph_created',
      taskGraphId: 'tg-1',
      payloadHash: 'aaa',
    });

    const duplicate = store.appendImplementationTaskGraphEvent({
      eventType: 'implementation_task_graph_created',
      taskGraphId: 'tg-1',
      payloadHash: 'aaa',
    });

    const second = store.appendImplementationTaskGraphEvent({
      eventType: 'implementation_task_graph_materialized',
      taskGraphId: 'tg-1',
      payloadHash: 'bbb',
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    expect(store.listImplementationTaskGraphEvents('tg-1')).toEqual([
      {
        eventType: 'implementation_task_graph_created',
        taskGraphId: 'tg-1',
        payloadHash: 'aaa',
      },
      {
        eventType: 'implementation_task_graph_materialized',
        taskGraphId: 'tg-1',
        payloadHash: 'bbb',
      },
    ]);
  });
});
