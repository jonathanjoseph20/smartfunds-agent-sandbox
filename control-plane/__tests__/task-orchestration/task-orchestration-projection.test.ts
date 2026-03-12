import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskOrchestrationHistoryStore } from '../../task-execution/task-orchestration-history-store.ts';
import { createTaskOrchestrationProjection } from '../../task-execution/task-orchestration-projection.ts';
import { createTaskExecutionHistoryStore } from '../../task-execution/task-execution-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-orchestration-projection');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task orchestration projection', () => {
  it('T-MTO-P1 deterministic replay for cycles, assignments, and deferrals', () => {
    const orchestrationStore = createTaskOrchestrationHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });
    const executionStore = createTaskExecutionHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    orchestrationStore.append({
      executionRunId: 'er-1',
      taskGraphId: 'tg-1',
      eventType: 'orchestration_cycle_started',
      eventPayload: {
        cycle: {
          orchestrationCycleId: 'c-1',
          executionRunId: 'er-1',
          taskGraphId: 'tg-1',
          cycleIndex: 1,
          workerSchedulingPolicyId: 'stable-lexical-default',
          runnableNodeIds: ['node-a'],
          eligibleWorkerIds: ['default-local-worker'],
          assignmentDecisionIds: [],
          deferredNodeIds: [],
          completedAssignmentCount: 0,
          queueUpdates: 0,
          cycleState: 'evaluating',
        },
      },
    });

    orchestrationStore.append({
      executionRunId: 'er-1',
      taskGraphId: 'tg-1',
      eventType: 'worker_assignment_deferred',
      eventPayload: {
        assignmentDecision: {
          assignmentDecisionId: 'd-1',
          executionRunId: 'er-1',
          taskNodeId: 'node-a',
          workerId: null,
          cycleIndex: 1,
          assignmentState: 'deferred',
          selectionReasonTokens: ['deterministic_rank:0'],
          deferralReasonTokens: ['worker_paused'],
          workerCompatibilitySummary: { compatibleWorkerIds: ['default-local-worker'], incompatibleWorkerIds: [] },
          workerCapacitySummary: { workerId: null, maxConcurrentAssignments: 1, currentAssignedCount: 0, remainingCapacity: 1 },
          alternativesConsidered: [],
          policyId: 'stable-lexical-default',
        },
      },
    });

    const projection = createTaskOrchestrationProjection({
      historyStore: orchestrationStore,
      taskExecutionHistoryStore: executionStore,
    });

    const first = projection.projectOne({ executionRunId: 'er-1', taskGraphId: 'tg-1' });
    const second = projection.projectOne({ executionRunId: 'er-1', taskGraphId: 'tg-1' });

    expect(second).toEqual(first);
    expect(first.currentCycleIndex).toBe(1);
    expect(first.deferredNodes[0]?.reasonTokens).toEqual(['worker_paused']);
  });
});
