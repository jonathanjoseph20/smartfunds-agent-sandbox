import { describe, expect, it } from 'vitest';

import type { ExecutionEvent } from '../../journal/types.ts';
import { buildWorkflowNodeRecords } from '../node-record.ts';

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

describe('workflow node record projection', () => {
  it('T-ON1 preserves dependencies and io snapshots deterministically', () => {
    const records = buildWorkflowNodeRecords({
      runId: 'run_smartfunds-core_0001',
      workflowId: 'rwa-market-analysis',
      events: [
        event({
          sequence: 1,
          type: 'TASK_STARTED',
          taskId: 'thesis-synthesis',
          payload: {
            agentId: 'lead-thesis-architect',
            adapterId: 'llm',
            task_inputs: { prompt: 'do-work' },
            context_snapshot: {
              memory: {
                previousOutputs: {
                  'market-research': { key: 'a' },
                  'regulatory-scan': { key: 'b' }
                }
              }
            }
          }
        }),
        event({
          sequence: 2,
          type: 'TASK_COMPLETED',
          taskId: 'thesis-synthesis',
          payload: {
            agentId: 'lead-thesis-architect',
            adapterId: 'llm',
            task_outputs: { memo: 'ok' },
            context_snapshot: { memory: { memo: 'ok' } }
          }
        })
      ]
    });

    expect(records).toHaveLength(1);
    expect(records[0].dependsOn).toEqual(['market-research', 'regulatory-scan']);
    expect(records[0].taskInputs).toEqual({ prompt: 'do-work' });
    expect(records[0].taskOutputs).toEqual({ memo: 'ok' });
    expect(records[0].previousOutputs).toEqual({
      'market-research': { key: 'a' },
      'regulatory-scan': { key: 'b' }
    });
    expect(records[0].contextSnapshot).toEqual({ memory: { memo: 'ok' } });
    expect(records[0].status).toBe('completed');
  });

  it('T-ON2 attaches failure record on failed node execution', () => {
    const records = buildWorkflowNodeRecords({
      runId: 'run_smartfunds-core_0001',
      workflowId: 'rwa-market-analysis',
      events: [
        event({
          sequence: 1,
          type: 'TASK_STARTED',
          taskId: 'market-research',
          payload: { agentId: 'macro-signal-analyst', adapterId: 'llm' }
        }),
        event({
          sequence: 2,
          type: 'TASK_FAILED',
          taskId: 'market-research',
          payload: {
            agentId: 'macro-signal-analyst',
            adapterId: 'llm',
            error: 'ERR_TASK_ADAPTER_EXECUTION: boom'
          }
        })
      ]
    });

    expect(records[0].status).toBe('failed');
    expect(records[0].failure).toMatchObject({
      code: 'ADAPTER_EXECUTION_FAILED',
      nodeId: 'market-research',
      agentId: 'macro-signal-analyst',
      adapterId: 'llm'
    });
    expect(records[0].sequenceCompleted).toBe(2);
  });
});
