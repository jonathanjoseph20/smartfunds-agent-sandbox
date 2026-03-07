import { describe, expect, it } from 'vitest';

import type { WorkflowNodeRecord } from '../node-record.ts';
import { buildWorkflowRunSummary } from '../summary-builder.ts';

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
    failure: input.failure ?? null,
    retryCount: input.retryCount ?? 0,
    timeoutType: input.timeoutType ?? null
  };
}

describe('workflow summary builder', () => {
  it('T-OS1 builds stable operator summary fields', () => {
    const summary = buildWorkflowRunSummary({
      runId: 'run_smartfunds-core_0001',
      workflowId: 'rwa-market-analysis',
      missionId: 'rwa-market-analysis',
      teamId: 'smartfunds-research-team',
      projectId: 'smartfunds-core',
      status: 'failed',
      activeNodeId: null,
      nodes: [
        node({ nodeId: 'market-research', status: 'completed', sequenceStarted: 1, sequenceCompleted: 2, agentId: 'macro-signal-analyst', taskOutputs: { report: true } }),
        node({ nodeId: 'thesis-synthesis', status: 'failed', sequenceStarted: 3, sequenceCompleted: 4, agentId: 'lead-thesis-architect', taskOutputs: { partial: true } })
      ]
    });

    expect(summary.nodeCount).toBe(2);
    expect(summary.completedNodeCount).toBe(1);
    expect(summary.failedNodeCount).toBe(1);
    expect(summary.totalOutputsGenerated).toBe(2);
    expect(summary.hasFailure).toBe(true);
    expect(summary.replayable).toBe(true);
    expect(summary.lastAgentUsed).toBe('lead-thesis-architect');
    expect(summary.timeoutNodeCount).toBe(0);
    expect(summary.totalRetriesConsumed).toBe(0);
  });
});
