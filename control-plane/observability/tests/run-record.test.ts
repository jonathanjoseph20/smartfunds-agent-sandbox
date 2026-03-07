import { describe, expect, it } from 'vitest';

import type { ExecutionEvent, ExecutionRun } from '../../journal/types.ts';
import { buildWorkflowRunRecord, buildWorkflowRunRecords } from '../run-record.ts';

function run(runId: string, createdIndex: number): ExecutionRun {
  return {
    runId,
    projectId: 'smartfunds-core',
    entity: 'core-entity',
    pod: 'smartfunds',
    mode: 'structured',
    kind: 'mission',
    status: 'pending',
    entrypoint: 'mission:rwa-market-analysis',
    createdIndex
  };
}

function event(input: {
  runId?: string;
  sequence: number;
  type: ExecutionEvent['type'];
  taskId?: string | null;
  payload?: Record<string, unknown>;
}): ExecutionEvent {
  const runId = input.runId ?? 'run_smartfunds-core_0001';
  return {
    runId,
    eventId: `${runId}_evt_${input.sequence}`,
    sequence: input.sequence,
    type: input.type,
    phase: 'plan',
    taskId: input.taskId ?? null,
    artifactId: null,
    payload: input.payload ?? {}
  };
}

const baseMetadata = {
  context_snapshot: {
    missionId: 'rwa-market-analysis',
    teamId: 'smartfunds-research-team',
    metadata: {
      workflowId: 'rwa-market-analysis',
      missionId: 'rwa-market-analysis',
      teamId: 'smartfunds-research-team',
      agentRoster: ['lead-thesis-architect', 'macro-signal-analyst']
    }
  }
};

describe('workflow run record projection', () => {
  it('T-OR1 projects completed run summary deterministically', () => {
    const record = buildWorkflowRunRecord({
      run: run('run_smartfunds-core_0001', 1),
      events: [
        event({ sequence: 1, type: 'RUN_CREATED', payload: baseMetadata }),
        event({ sequence: 2, type: 'TASK_STARTED', taskId: 'market-research', payload: { ...baseMetadata, agentId: 'macro-signal-analyst' } }),
        event({ sequence: 3, type: 'TASK_COMPLETED', taskId: 'market-research', payload: { ...baseMetadata, task_outputs: { memo: 'ok' } } }),
        event({ sequence: 4, type: 'RUN_COMPLETED', payload: baseMetadata })
      ]
    });

    expect(record.status).toBe('completed');
    expect(record.completedNodeCount).toBe(1);
    expect(record.failedNodeCount).toBe(0);
    expect(record.endSequence).toBe(4);
    expect(record.summary.replayable).toBe(true);
  });

  it('T-OR2 projects failed and active state signals', () => {
    const failed = buildWorkflowRunRecord({
      run: run('run_smartfunds-core_0002', 2),
      events: [
        event({ runId: 'run_smartfunds-core_0002', sequence: 1, type: 'RUN_CREATED', payload: baseMetadata }),
        event({ runId: 'run_smartfunds-core_0002', sequence: 2, type: 'TASK_STARTED', taskId: 'market-research', payload: { ...baseMetadata, agentId: 'macro-signal-analyst' } }),
        event({ runId: 'run_smartfunds-core_0002', sequence: 3, type: 'TASK_FAILED', taskId: 'market-research', payload: { ...baseMetadata, error: 'ERR_TASK_ADAPTER_EXECUTION: boom' } }),
        event({ runId: 'run_smartfunds-core_0002', sequence: 4, type: 'RUN_FAILED', taskId: 'market-research', payload: baseMetadata })
      ]
    });

    const active = buildWorkflowRunRecord({
      run: run('run_smartfunds-core_0003', 3),
      events: [
        event({ runId: 'run_smartfunds-core_0003', sequence: 1, type: 'RUN_CREATED', payload: baseMetadata }),
        event({ runId: 'run_smartfunds-core_0003', sequence: 2, type: 'TASK_STARTED', taskId: 'market-research', payload: baseMetadata })
      ]
    });

    expect(failed.status).toBe('failed');
    expect(failed.failedNodeCount).toBe(1);
    expect(active.status).toBe('running');
    expect(active.activeNodeId).toBe('market-research');
    expect(active.endSequence).toBeNull();
  });

  it('T-OR3 orders run lists by createdIndex deterministically', () => {
    const runs = [run('run_smartfunds-core_0002', 2), run('run_smartfunds-core_0001', 1)];
    const map = new Map<string, { run: ExecutionRun; events: ExecutionEvent[] }>([
      ['run_smartfunds-core_0001', {
        run: runs[1],
        events: [event({ runId: 'run_smartfunds-core_0001', sequence: 1, type: 'RUN_CREATED', payload: baseMetadata })]
      }],
      ['run_smartfunds-core_0002', {
        run: runs[0],
        events: [event({ runId: 'run_smartfunds-core_0002', sequence: 1, type: 'RUN_CREATED', payload: baseMetadata })]
      }]
    ]);

    const records = buildWorkflowRunRecords({
      runs,
      inspectRun: (runId) => {
        const entry = map.get(runId);
        if (!entry) throw new Error('missing');
        return entry;
      }
    });

    expect(records.map((entry) => entry.runId)).toEqual([
      'run_smartfunds-core_0001',
      'run_smartfunds-core_0002'
    ]);
  });
});
