import { describe, expect, it } from 'vitest';

import type { ExecutionEvent } from '../../journal/types.ts';
import { buildWorkflowTrace } from '../trace-builder.ts';

function event(input: {
  sequence: number;
  type: ExecutionEvent['type'];
  taskId?: string | null;
  payload?: Record<string, unknown>;
}): ExecutionEvent {
  return {
    runId: 'run_smartfunds-core_0001',
    eventId: `evt_${input.sequence}`,
    sequence: input.sequence,
    type: input.type,
    phase: 'plan',
    taskId: input.taskId ?? null,
    artifactId: null,
    payload: input.payload ?? {}
  };
}

describe('workflow trace builder', () => {
  it('T-OT1 emits stable ordered trace entries without duplicates', () => {
    const trace = buildWorkflowTrace({
      runId: 'run_smartfunds-core_0001',
      workflowId: 'rwa-market-analysis',
      events: [
        event({ sequence: 1, type: 'RUN_CREATED' }),
        event({ sequence: 2, type: 'TASK_STARTED', taskId: 'market-research', payload: { agentId: 'macro-signal-analyst', adapterId: 'llm' } }),
        event({ sequence: 3, type: 'TASK_COMPLETED', taskId: 'market-research', payload: { agentId: 'macro-signal-analyst', adapterId: 'llm' } }),
        event({ sequence: 4, type: 'RUN_COMPLETED' })
      ]
    });

    expect(trace.map((entry) => entry.type)).toEqual([
      'RUN_STARTED',
      'NODE_STARTED',
      'NODE_COMPLETED',
      'NODE_BECAME_RUNNABLE',
      'RUN_COMPLETED'
    ]);
    expect(trace[2].agentId).toBe('macro-signal-analyst');
    expect(trace[2].adapterId).toBe('llm');
    expect(new Set(trace.map((entry) => `${entry.sequence}|${entry.type}|${entry.nodeId ?? ''}`)).size).toBe(trace.length);
  });

  it('T-OT2 truncates consistently at failure boundary', () => {
    const trace = buildWorkflowTrace({
      runId: 'run_smartfunds-core_0001',
      workflowId: 'rwa-market-analysis',
      events: [
        event({ sequence: 1, type: 'RUN_CREATED' }),
        event({ sequence: 2, type: 'TASK_STARTED', taskId: 'market-research' }),
        event({ sequence: 3, type: 'TASK_FAILED', taskId: 'market-research', payload: { error: 'boom' } }),
        event({ sequence: 4, type: 'RUN_FAILED', taskId: 'market-research' }),
        event({ sequence: 5, type: 'TASK_COMPLETED', taskId: 'ignored' })
      ]
    });

    expect(trace.at(-1)?.type).toBe('RUN_FAILED');
    expect(trace.some((entry) => entry.nodeId === 'ignored')).toBe(false);
  });
});
