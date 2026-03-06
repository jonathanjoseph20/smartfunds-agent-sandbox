import { describe, expect, it } from 'vitest';

import { reduceRunSummary } from './reducer.ts';
import type { ExecutionEvent, ExecutionRun } from './types.ts';

const baseRun: ExecutionRun = {
  runId: 'run_control-plane_0001',
  projectId: 'control-plane',
  entity: 'core-entity',
  pod: 'smartfunds',
  mode: 'structured',
  kind: 'governance',
  status: 'pending',
  entrypoint: 'governance:preflight',
  createdIndex: 1
};

function event(input: Partial<ExecutionEvent> & Pick<ExecutionEvent, 'sequence' | 'type' | 'phase'>): ExecutionEvent {
  return {
    runId: baseRun.runId,
    eventId: `evt_${baseRun.runId}_${String(input.sequence).padStart(4, '0')}`,
    sequence: input.sequence,
    type: input.type,
    phase: input.phase,
    taskId: input.taskId ?? null,
    artifactId: input.artifactId ?? null,
    payload: input.payload ?? {}
  };
}

describe('journal reducer', () => {
  it('derives running state with task and artifact counts', () => {
    const summary = reduceRunSummary(baseRun, [
      event({ sequence: 1, type: 'RUN_CREATED', phase: 'plan' }),
      event({ sequence: 2, type: 'PHASE_STARTED', phase: 'plan' }),
      event({ sequence: 3, type: 'TASK_COMPLETED', phase: 'implement' }),
      event({ sequence: 4, type: 'TASK_FAILED', phase: 'verify' }),
      event({ sequence: 5, type: 'ARTIFACT_RECORDED', phase: 'release' })
    ]);

    expect(summary.status).toBe('running');
    expect(summary.currentPhase).toBe('release');
    expect(summary.lastCompletedPhase).toBe(null);
    expect(summary.tasksCompleted).toBe(1);
    expect(summary.tasksFailed).toBe(1);
    expect(summary.artifactsProduced).toBe(1);
  });

  it('derives completed state', () => {
    const summary = reduceRunSummary(baseRun, [
      event({ sequence: 1, type: 'PHASE_STARTED', phase: 'implement' }),
      event({ sequence: 2, type: 'PHASE_COMPLETED', phase: 'implement' }),
      event({ sequence: 3, type: 'RUN_COMPLETED', phase: 'release' })
    ]);

    expect(summary.status).toBe('completed');
    expect(summary.currentPhase).toBe('release');
    expect(summary.lastCompletedPhase).toBe('implement');
    expect(summary.totalEvents).toBe(3);
  });

  it('derives failed state', () => {
    const summary = reduceRunSummary(baseRun, [
      event({ sequence: 1, type: 'TASK_STARTED', phase: 'verify' }),
      event({ sequence: 2, type: 'TASK_FAILED', phase: 'verify' }),
      event({ sequence: 3, type: 'RUN_FAILED', phase: 'verify' })
    ]);

    expect(summary.status).toBe('failed');
    expect(summary.tasksFailed).toBe(1);
  });

  it('rejects out-of-order events', () => {
    expect(() => reduceRunSummary(baseRun, [
      event({ sequence: 2, type: 'RUN_CREATED', phase: 'plan' })
    ])).toThrow(/expected sequence 1/);
  });
});
