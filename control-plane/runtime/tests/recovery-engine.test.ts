import { describe, expect, it } from 'vitest';

import type { ExecutionEvent } from '../../journal/types.ts';
import { buildWorkflowRunRecord } from '../../observability/run-record.ts';
import { buildWorkflowTrace } from '../../observability/trace-builder.ts';
import { loadWorkflowDefinition } from '../../workflows/workflow-loader.ts';
import {
  cancelWorkflowRun,
  determineRecoveryPlan,
  deriveRetryEligibilityFromEvents,
  reconstructWorkflowStateFromJournal,
  resumeWorkflowRun
} from '../recovery-engine.ts';

function event(input: {
  sequence: number;
  type: ExecutionEvent['type'];
  taskId?: string;
  payload?: Record<string, unknown>;
}): ExecutionEvent {
  return {
    runId: 'run_control-plane_0001',
    eventId: `evt_${input.sequence}`,
    sequence: input.sequence,
    type: input.type,
    phase: 'implement',
    taskId: input.taskId ?? null,
    artifactId: null,
    payload: input.payload ?? {}
  };
}

describe('runtime recovery engine', () => {
  it('T-RE1 reconstructs deterministic node/workflow state from journal', () => {
    const state = reconstructWorkflowStateFromJournal({
      runId: 'run_control-plane_0001',
      workflowId: 'wf-hardening',
      events: [
        event({ sequence: 1, type: 'RUN_CREATED' }),
        event({ sequence: 2, type: 'TASK_STARTED', taskId: 'node1' }),
        event({ sequence: 3, type: 'TASK_COMPLETED', taskId: 'node1' }),
        event({ sequence: 4, type: 'TASK_STARTED', taskId: 'node2' }),
        event({ sequence: 5, type: 'NODE_TIMEOUT', taskId: 'node2', payload: { failureCode: 'NODE_TIMEOUT' } }),
        event({ sequence: 6, type: 'RUN_FAILED', taskId: 'node2' })
      ]
    });

    expect(state.workflowState).toBe('failed');
    expect(state.completedNodeIds).toEqual(['node1']);
    expect(state.timedOutNodeIds).toEqual(['node2']);
    expect(state.currentTick).toBe(6);
  });

  it('T-RE2 plans deterministic recovery and skips completed nodes', () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-hardening',
      nodes: [
        { id: 'node1', task: 'task-1' },
        { id: 'node2', task: 'task-2', dependsOn: ['node1'] },
        { id: 'node3', task: 'task-3', dependsOn: ['node2'] }
      ]
    });

    const state = reconstructWorkflowStateFromJournal({
      runId: 'run_control-plane_0001',
      workflowId: workflow.workflowId,
      events: [
        event({ sequence: 1, type: 'RUN_CREATED' }),
        event({ sequence: 2, type: 'TASK_STARTED', taskId: 'node1' }),
        event({ sequence: 3, type: 'TASK_COMPLETED', taskId: 'node1' }),
        event({ sequence: 4, type: 'TASK_STARTED', taskId: 'node2' }),
        event({ sequence: 5, type: 'TASK_FAILED', taskId: 'node2', payload: { failureCode: 'ADAPTER_EXECUTION_FAILED' } }),
        event({ sequence: 6, type: 'RUN_FAILED', taskId: 'node2' })
      ]
    });

    const plan = determineRecoveryPlan({ workflow, state });
    expect(plan.recoverable).toBe(true);
    expect(plan.resumeNodeIds).toEqual(['node2']);
    expect(plan.skippedCompletedNodeIds).toEqual(['node1']);

    const resume = resumeWorkflowRun({ workflow, state });
    expect(resume.accepted).toBe(true);
    expect(resume.plan.resumeNodeIds).toEqual(['node2']);
  });

  it('T-RE3 derives retry eligibility and retry exhaustion deterministically', () => {
    const events: ExecutionEvent[] = [
      event({ sequence: 1, type: 'RUN_CREATED' }),
      event({ sequence: 2, type: 'TASK_STARTED', taskId: 'node2' }),
      event({ sequence: 3, type: 'TASK_FAILED', taskId: 'node2', payload: { failureCode: 'ADAPTER_EXECUTION_FAILED' } }),
      event({ sequence: 4, type: 'NODE_RETRY_SCHEDULED', taskId: 'node2', payload: { retryAttempt: 1 } }),
      event({ sequence: 5, type: 'NODE_RETRY_STARTED', taskId: 'node2', payload: { retryAttempt: 1 } }),
      event({ sequence: 6, type: 'TASK_FAILED', taskId: 'node2', payload: { failureCode: 'ADAPTER_EXECUTION_FAILED' } })
    ];

    const decision = deriveRetryEligibilityFromEvents({
      runId: 'run_control-plane_0001',
      workflowId: 'wf-hardening',
      nodeId: 'node2',
      events
    });

    expect(decision.accepted).toBe(true);
    expect(decision.retryAttempt).toBe(2);
    expect(decision.tickDelay).toBe(1);
  });

  it('T-RE4 returns stable cancellation behavior', () => {
    const state = reconstructWorkflowStateFromJournal({
      runId: 'run_control-plane_0001',
      workflowId: 'wf-hardening',
      events: [event({ sequence: 1, type: 'RUN_CREATED' })]
    });

    expect(cancelWorkflowRun({ state })).toEqual({ accepted: true, reason: 'CANCELLED' });
  });

  it('T-RE5 preserves deterministic reconstruction for identical input', () => {
    const events: ExecutionEvent[] = [
      event({ sequence: 1, type: 'RUN_CREATED' }),
      event({ sequence: 2, type: 'TASK_STARTED', taskId: 'node1' }),
      event({ sequence: 3, type: 'TASK_COMPLETED', taskId: 'node1' })
    ];

    const left = reconstructWorkflowStateFromJournal({
      runId: 'run_control-plane_0001',
      workflowId: 'wf-hardening',
      events
    });
    const right = reconstructWorkflowStateFromJournal({
      runId: 'run_control-plane_0001',
      workflowId: 'wf-hardening',
      events
    });

    expect(left).toEqual(right);
  });

  it('T-RE6 projects timeout->retry->success flow into summary/trace deterministically', () => {
    const events: ExecutionEvent[] = [
      event({ sequence: 1, type: 'RUN_CREATED', payload: { context_snapshot: { metadata: { workflowId: 'wf-hardening' } } } }),
      event({ sequence: 2, type: 'TASK_STARTED', taskId: 'node1', payload: { context_snapshot: { metadata: { workflowId: 'wf-hardening' } } } }),
      event({ sequence: 3, type: 'TASK_COMPLETED', taskId: 'node1', payload: { context_snapshot: { metadata: { workflowId: 'wf-hardening' } } } }),
      event({ sequence: 4, type: 'TASK_STARTED', taskId: 'node2', payload: { context_snapshot: { metadata: { workflowId: 'wf-hardening' } } } }),
      event({ sequence: 5, type: 'NODE_TIMEOUT', taskId: 'node2', payload: { failureCode: 'NODE_TIMEOUT' } }),
      event({ sequence: 6, type: 'NODE_RETRY_SCHEDULED', taskId: 'node2', payload: { retryAttempt: 1, tickDelay: 0 } }),
      event({ sequence: 7, type: 'NODE_RETRY_STARTED', taskId: 'node2', payload: { retryAttempt: 1 } }),
      event({ sequence: 8, type: 'TASK_COMPLETED', taskId: 'node2', payload: { context_snapshot: { metadata: { workflowId: 'wf-hardening' } } } }),
      event({ sequence: 9, type: 'TASK_STARTED', taskId: 'node3', payload: { context_snapshot: { metadata: { workflowId: 'wf-hardening' } } } }),
      event({ sequence: 10, type: 'TASK_COMPLETED', taskId: 'node3', payload: { context_snapshot: { metadata: { workflowId: 'wf-hardening' } } } }),
      event({ sequence: 11, type: 'RUN_COMPLETED', payload: { context_snapshot: { metadata: { workflowId: 'wf-hardening' } } } })
    ];

    const runRecord = buildWorkflowRunRecord({
      run: {
        runId: 'run_control-plane_0001',
        projectId: 'control-plane',
        entity: 'core-entity',
        pod: 'smartfunds',
        mode: 'structured',
        kind: 'mission',
        status: 'pending',
        entrypoint: 'workflow:wf-hardening',
        createdIndex: 1
      },
      events
    });

    const trace = buildWorkflowTrace({
      runId: 'run_control-plane_0001',
      workflowId: 'wf-hardening',
      events
    });

    expect(runRecord.status).toBe('completed');
    expect(runRecord.retryCount).toBe(1);
    expect(runRecord.summary.totalRetriesConsumed).toBe(1);
    expect(trace.some((entry) => entry.type === 'NODE_TIMEOUT')).toBe(true);
    expect(trace.some((entry) => entry.type === 'NODE_RETRY_SCHEDULED')).toBe(true);
    expect(trace.some((entry) => entry.type === 'NODE_RETRY_STARTED')).toBe(true);
  });
});
