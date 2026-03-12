import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeTaskGraphEventDedupeKey,
  createTaskGraphHistoryStore,
} from '../../task-graph/task-graph-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-graph-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task graph history store', () => {
  it('T-MTG-H1 append-only dedupe behavior is deterministic', () => {
    const store = createTaskGraphHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      taskGraphId: 'tg-1',
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      eventType: 'graph_initialized',
      reasoning: 'initialized',
      eventPayload: { state: 'initialized' },
    });

    const second = store.append({
      taskGraphId: 'tg-1',
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      eventType: 'graph_initialized',
      reasoning: 'initialized',
      eventPayload: { state: 'initialized' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MTG-H2 event index ordering is deterministic across repeated loads', () => {
    const store = createTaskGraphHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      taskGraphId: 'tg-1',
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      eventType: 'graph_initialized',
      reasoning: 'initialized',
      eventPayload: {},
    });

    store.append({
      taskGraphId: 'tg-1',
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      eventType: 'graph_evaluated',
      reasoning: 'evaluated',
      eventPayload: {},
    });

    const first = store.load({
      taskGraphId: 'tg-1',
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
    });
    const second = store.load({
      taskGraphId: 'tg-1',
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
    });

    expect(first.entries.map((entry) => entry.eventIndex)).toEqual([0, 1]);
    expect(second).toEqual(first);
  });

  it('T-MTG-H3 event dedupe key is deterministic', () => {
    const input = {
      taskGraphId: 'tg-1',
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      eventType: 'graph_blocked' as const,
      reasoning: 'blocked',
      eventPayload: { reason: 'x' },
    };

    expect(computeTaskGraphEventDedupeKey(input)).toBe(computeTaskGraphEventDedupeKey(input));
  });
});
