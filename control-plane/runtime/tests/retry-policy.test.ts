import { describe, expect, it } from 'vitest';

import { evaluateRetryPolicy } from '../retry-policy.ts';
import {
  collectReadyRetries,
  dependenciesSatisfiedForRetry,
  scheduleRetry,
  sortRetryQueue,
  type RetryQueueItem
} from '../retry-scheduler.ts';
import { loadWorkflowDefinition } from '../../workflows/workflow-loader.ts';

describe('runtime retry policy', () => {
  it('T-RP1 applies deterministic retry delays', () => {
    expect(evaluateRetryPolicy({ failureCode: 'ADAPTER_EXECUTION_FAILED', previousRetryCount: 0 })).toMatchObject({
      eligible: true,
      retryAttempt: 1,
      tickDelay: 0
    });
    expect(evaluateRetryPolicy({ failureCode: 'ADAPTER_EXECUTION_FAILED', previousRetryCount: 1 })).toMatchObject({
      eligible: true,
      retryAttempt: 2,
      tickDelay: 1
    });
    expect(evaluateRetryPolicy({ failureCode: 'ADAPTER_EXECUTION_FAILED', previousRetryCount: 2 })).toMatchObject({
      eligible: true,
      retryAttempt: 3,
      tickDelay: 2
    });
  });

  it('T-RP2 marks exhaustion deterministically', () => {
    const decision = evaluateRetryPolicy({
      failureCode: 'ADAPTER_EXECUTION_FAILED',
      previousRetryCount: 3
    });

    expect(decision.eligible).toBe(false);
    expect(decision.reason).toBe('RETRY_EXHAUSTED');
    expect(decision.exhausted).toBe(true);
  });

  it('T-RP3 enforces retry queue order stability', () => {
    const queue: RetryQueueItem[] = [
      { runId: 'run-1', workflowId: 'wf', nodeId: 'b', retryAttempt: 2, scheduledTick: 3 },
      { runId: 'run-1', workflowId: 'wf', nodeId: 'a', retryAttempt: 1, scheduledTick: 3 },
      { runId: 'run-1', workflowId: 'wf', nodeId: 'c', retryAttempt: 1, scheduledTick: 2 }
    ];

    expect(sortRetryQueue(queue).map((entry) => `${entry.scheduledTick}:${entry.nodeId}:${entry.retryAttempt}`)).toEqual([
      '2:c:1',
      '3:a:1',
      '3:b:2'
    ]);
  });

  it('T-RP4 honors dependencies before retry readiness', () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf',
      nodes: [
        { id: 'a', task: 'task-a' },
        { id: 'b', task: 'task-b', dependsOn: ['a'] }
      ]
    });

    expect(dependenciesSatisfiedForRetry({
      workflow,
      nodeId: 'b',
      completedNodeIds: []
    })).toBe(false);

    expect(dependenciesSatisfiedForRetry({
      workflow,
      nodeId: 'b',
      completedNodeIds: ['a']
    })).toBe(true);
  });

  it('T-RP5 collects ready retries by tick and dependency gate', () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf',
      nodes: [
        { id: 'a', task: 'task-a' },
        { id: 'b', task: 'task-b', dependsOn: ['a'] }
      ]
    });

    let queue: RetryQueueItem[] = [];
    queue = scheduleRetry({
      queue,
      runId: 'run-1',
      workflowId: 'wf',
      nodeId: 'b',
      retryAttempt: 1,
      currentTick: 3,
      tickDelay: 1
    });

    const tick4NoDeps = collectReadyRetries({
      queue,
      currentTick: 4,
      workflow,
      completedNodeIds: []
    });
    expect(tick4NoDeps).toEqual([]);

    const tick4WithDeps = collectReadyRetries({
      queue,
      currentTick: 4,
      workflow,
      completedNodeIds: ['a']
    });
    expect(tick4WithDeps.map((entry) => entry.nodeId)).toEqual(['b']);
  });
});
