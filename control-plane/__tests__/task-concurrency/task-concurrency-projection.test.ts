import { describe, expect, it } from 'vitest';

import { deriveTaskConcurrencyProjection } from '../../task-execution/task-concurrency-projection.ts';

describe('task concurrency projection', () => {
  it('T-MTC-P1 backward-compatible default projection for legacy history', () => {
    const result = deriveTaskConcurrencyProjection({
      historyEntries: [],
      graphState: 'running',
      runningNodeCount: 0,
    });

    expect(result.runnableNodeCount).toBe(0);
    expect(result.scheduledNodeCount).toBe(0);
    expect(result.deferredNodeCount).toBe(0);
    expect(result.concurrencyPolicyId).toBe('parallel-wave-default');
    expect(result.currentWaveIndex).toBe(0);
  });

  it('T-MTC-P2 replay from concurrency history is deterministic', () => {
    const entries = [
      {
        eventType: 'concurrency_wave_evaluated' as const,
        eventPayload: {
          executionEngineRunId: 'er-1',
          taskGraphId: 'tg-1',
          waveIndex: 1,
          concurrencyPolicyId: 'parallel-wave-default',
          runnableNodeIds: ['node-a', 'node-b'],
          scheduledNodeIds: ['node-a'],
          deferredNodeIds: ['node-b'],
          availableSlots: 1,
          consumedSlots: 1,
        },
      },
      {
        eventType: 'concurrency_wave_completed' as const,
        eventPayload: {
          executionEngineRunId: 'er-1',
          taskGraphId: 'tg-1',
          waveIndex: 1,
          concurrencyPolicyId: 'parallel-wave-default',
          runnableNodeIds: ['node-a', 'node-b'],
          scheduledNodeIds: ['node-a'],
          deferredNodeIds: ['node-b'],
          availableSlots: 1,
          consumedSlots: 1,
        },
      },
    ];

    const first = deriveTaskConcurrencyProjection({
      historyEntries: entries,
      graphState: 'running',
      runningNodeCount: 0,
    });

    const second = deriveTaskConcurrencyProjection({
      historyEntries: entries,
      graphState: 'running',
      runningNodeCount: 0,
    });

    expect(first).toEqual(second);
    expect(first.currentWaveIndex).toBe(1);
    expect(first.currentWaveNodeIds).toEqual(['node-a']);
    expect(first.deferredNodeIds).toEqual(['node-b']);
    expect(first.schedulingState).toBe('deferred_by_limit');
  });
});
