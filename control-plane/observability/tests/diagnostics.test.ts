import { describe, expect, it } from 'vitest';

import type { WorkflowNodeRecord } from '../node-record.ts';
import { extractWorkflowFailures, firstInspectTarget, summarizeContextChanges } from '../diagnostics.ts';

function node(input: Partial<WorkflowNodeRecord> & { nodeId: string; status: WorkflowNodeRecord['status']; sequenceStarted: number }): WorkflowNodeRecord {
  return {
    runId: 'run_smartfunds-core_0001',
    workflowId: 'rwa-market-analysis',
    nodeId: input.nodeId,
    agentId: input.agentId ?? null,
    adapterId: input.adapterId ?? null,
    status: input.status,
    dependsOn: input.dependsOn ?? [],
    sequenceStarted: input.sequenceStarted,
    sequenceCompleted: input.sequenceCompleted ?? null,
    taskInputs: input.taskInputs ?? {},
    taskOutputs: input.taskOutputs ?? {},
    previousOutputs: input.previousOutputs ?? {},
    contextSnapshot: input.contextSnapshot ?? {},
    failure: input.failure ?? null
  };
}

describe('workflow diagnostics', () => {
  it('T-OD1 extracts failures deterministically', () => {
    const failures = extractWorkflowFailures([
      node({ nodeId: 'b', status: 'failed', sequenceStarted: 2, failure: { code: 'UNKNOWN_RUNTIME_FAILURE', message: 'm', nodeId: 'b', agentId: null, adapterId: null, details: {} } }),
      node({ nodeId: 'a', status: 'failed', sequenceStarted: 1, failure: { code: 'AGENT_RESOLUTION_FAILED', message: 'n', nodeId: 'a', agentId: null, adapterId: null, details: {} } })
    ]);

    expect(failures.map((entry) => entry.nodeId)).toEqual(['a', 'b']);
    expect(failures[0].code).toBe('AGENT_RESOLUTION_FAILED');
  });

  it('T-OD2 computes deterministic context diffs', () => {
    const diff = summarizeContextChanges({
      previous: { a: 1, b: 2 },
      next: { b: 3, c: 4 },
      outputKeyCount: 2
    });

    expect(diff).toEqual({
      addedKeys: ['c'],
      updatedKeys: ['b'],
      removedKeys: ['a'],
      outputKeyCount: 2
    });
  });

  it('T-OD3 resolves first inspect target using deterministic priority', () => {
    const failedTarget = firstInspectTarget({
      runId: 'run_smartfunds-core_0001',
      status: 'failed',
      activeNodeId: null,
      nodes: [node({ nodeId: 'x', status: 'failed', sequenceStarted: 2 })]
    });

    const activeTarget = firstInspectTarget({
      runId: 'run_smartfunds-core_0001',
      status: 'running',
      activeNodeId: 'active-node',
      nodes: [node({ nodeId: 'active-node', status: 'running', sequenceStarted: 1 })]
    });

    const completedTarget = firstInspectTarget({
      runId: 'run_smartfunds-core_0001',
      status: 'completed',
      activeNodeId: null,
      nodes: [node({ nodeId: 'z', status: 'completed', sequenceStarted: 1, sequenceCompleted: 2 })]
    });

    expect(failedTarget).toEqual({ targetType: 'node', nodeId: 'x' });
    expect(activeTarget).toEqual({ targetType: 'node', nodeId: 'active-node' });
    expect(completedTarget).toEqual({ targetType: 'node', nodeId: 'z' });
  });
});
