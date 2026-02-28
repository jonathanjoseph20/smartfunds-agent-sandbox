import { describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../../finance/determinism.ts';
import { computeEventId } from './events.ts';
import { computeEventIngestRunId, computeSwarmRunId } from './journal.ts';
import { computeTaskId } from './tasks.ts';

describe('service storage determinism', () => {
  it('computes identical event_id for semantically identical payloads', () => {
    const payloadA = canonicalStringify({ b: 2, a: 1, nested: { y: 2, x: 1 } });
    const payloadB = canonicalStringify({ nested: { x: 1, y: 2 }, a: 1, b: 2 });

    expect(computeEventId('test', payloadA)).toBe(computeEventId('test', payloadB));
  });

  it('computes task_id using exact formula', () => {
    const taskId = computeTaskId('event-1', 'TestHandler', 0);
    expect(taskId).toBe(sha256('event-1\nTestHandler\n0'));
  });

  it('computes stable swarm run_id for identical canonical result', () => {
    const canonicalResult = canonicalStringify({ branchName: 'swarm/dev-team/run-1', ok: true });
    const first = computeSwarmRunId(canonicalResult);
    const second = computeSwarmRunId(canonicalResult);
    expect(first).toBe(second);
  });

  it('computes stable event ingest run_id for identical input', () => {
    const canonicalHandlerResult = canonicalStringify({ ok: true, code: 'stub_ok' });
    const first = computeEventIngestRunId('test', 'event-1', canonicalHandlerResult);
    const second = computeEventIngestRunId('test', 'event-1', canonicalHandlerResult);
    expect(first).toBe(second);
  });
});
