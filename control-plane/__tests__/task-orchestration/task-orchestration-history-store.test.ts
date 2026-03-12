import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskOrchestrationHistoryStore } from '../../task-execution/task-orchestration-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-orchestration-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task orchestration history store', () => {
  it('T-MTO-H1 append-only dedupe and deterministic event indexing', () => {
    const store = createTaskOrchestrationHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const first = store.append({
      executionRunId: 'er-1',
      taskGraphId: 'tg-1',
      eventType: 'orchestration_cycle_started',
      eventPayload: { cycleIndex: 1 },
    });

    const second = store.append({
      executionRunId: 'er-1',
      taskGraphId: 'tg-1',
      eventType: 'orchestration_cycle_started',
      eventPayload: { cycleIndex: 1 },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
    expect(second.history.entries[0]?.eventIndex).toBe(0);
  });
});
