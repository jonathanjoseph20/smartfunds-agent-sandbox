import { describe, expect, it } from 'vitest';

import { deriveMissionProgress } from '../../mission-control/mission-progress.ts';

describe('mission progress', () => {
  it('T-MC-P1 computes deterministic task counts and completion percent', () => {
    const progress = deriveMissionProgress({
      taskExecutionProjection: {
        nodeStates: {
          a: 'pending',
          b: 'ready',
          c: 'running',
          d: 'retrying',
          e: 'completed',
          f: 'failed',
          g: 'blocked',
          h: 'skipped',
        },
        blockingNodes: ['g', 'f'],
      },
      taskOrchestrationProjection: {
        deferredNodes: [{ taskNodeId: 'b' }],
      },
    });

    expect(progress.totalTaskCount).toBe(8);
    expect(progress.pendingTaskCount).toBe(1);
    expect(progress.readyTaskCount).toBe(1);
    expect(progress.runningTaskCount).toBe(1);
    expect(progress.retryingTaskCount).toBe(1);
    expect(progress.completedTaskCount).toBe(1);
    expect(progress.failedTaskCount).toBe(1);
    expect(progress.blockedTaskCount).toBe(1);
    expect(progress.skippedTaskCount).toBe(1);
    expect(progress.completionPercent).toBe(12.5);
    expect(progress.remainingBlockingNodes).toEqual(['b', 'f', 'g']);
  });
});
