import { describe, expect, it, vi } from 'vitest';

import { loadWorkflowDefinition } from '../workflow-loader.ts';
import { runWorkflow, type WorkflowTaskExecutor } from '../workflow-runner.ts';

describe('workflow-runner', () => {
  it('T-WR1 executes nodes in deterministic order', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-order',
      nodes: [
        { id: 'b', task: 'task-b' },
        { id: 'a', task: 'task-a' },
        { id: 'c', task: 'task-c', dependsOn: ['a'] }
      ]
    });

    const seen: string[] = [];
    const executor: WorkflowTaskExecutor = {
      execute(input) {
        seen.push(input.workflowNodeId);
        return { ok: input.workflowNodeId };
      }
    };

    const result = await runWorkflow({
      missionId: 'mission-1',
      workflow,
      executor
    });

    expect(seen).toEqual(['a', 'b', 'c']);
    expect(result.executionOrder).toEqual(['a', 'b', 'c']);
  });

  it('T-WR2 passes agent binding to executor', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-agent',
      nodes: [
        { id: 'a', task: 'task-a', agent: 'macro-signal-analyst' }
      ]
    });

    const execute = vi.fn((input: Parameters<WorkflowTaskExecutor['execute']>[0]) => ({ ok: input.agent }));

    await runWorkflow({
      missionId: 'mission-2',
      workflow,
      executor: { execute }
    });

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      workflowNodeId: 'a',
      agent: 'macro-signal-analyst'
    }));
  });

  it('T-WR3 propagates previousOutputs to downstream nodes', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-context',
      nodes: [
        { id: 'research', task: 'research' },
        { id: 'review', task: 'review', dependsOn: ['research'] }
      ]
    });

    const seenPreviousOutputs: Array<Record<string, unknown>> = [];
    const executor: WorkflowTaskExecutor = {
      execute(input) {
        seenPreviousOutputs.push(input.previousOutputs);
        return { node: input.workflowNodeId, result: `${input.workflowNodeId}-output` };
      }
    };

    await runWorkflow({
      missionId: 'mission-3',
      workflow,
      executor
    });

    expect(seenPreviousOutputs[0]).toEqual({});
    expect(seenPreviousOutputs[1]).toEqual({
      research: {
        node: 'research',
        result: 'research-output'
      }
    });
  });

  it('T-WR4 supports fan-in dependencies with both upstream outputs', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-fanin',
      nodes: [
        { id: 'a', task: 'task-a' },
        { id: 'b', task: 'task-b' },
        { id: 'c', task: 'task-c', dependsOn: ['a', 'b'] }
      ]
    });

    const execute = vi.fn((input: Parameters<WorkflowTaskExecutor['execute']>[0]) => {
      if (input.workflowNodeId === 'c') {
        expect(input.previousOutputs).toEqual({
          a: { value: 'A' },
          b: { value: 'B' }
        });
      }

      if (input.workflowNodeId === 'a') {
        return { value: 'A' };
      }
      if (input.workflowNodeId === 'b') {
        return { value: 'B' };
      }
      return { value: 'C' };
    });

    const result = await runWorkflow({
      missionId: 'mission-4',
      workflow,
      executor: { execute }
    });

    expect(result.executionOrder).toEqual(['a', 'b', 'c']);
  });

  it('T-WR5 preserves sequential execution when multiple nodes are runnable', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-sequential',
      nodes: [
        { id: 'b', task: 'task-b' },
        { id: 'a', task: 'task-a' },
        { id: 'c', task: 'task-c' }
      ]
    });

    const sequence: string[] = [];
    const executor: WorkflowTaskExecutor = {
      execute(input) {
        sequence.push(input.workflowNodeId);
        return { ok: true };
      }
    };

    await runWorkflow({
      missionId: 'mission-5',
      workflow,
      executor
    });

    expect(sequence).toEqual(['a', 'b', 'c']);
  });

  it('T-WR6 surfaces execution failures with workflow/node context', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-failure',
      nodes: [
        { id: 'a', task: 'task-a' }
      ]
    });

    const executor: WorkflowTaskExecutor = {
      execute() {
        throw new Error('boom');
      }
    };

    await expect(runWorkflow({
      missionId: 'mission-6',
      workflow,
      executor
    })).rejects.toThrow('workflow.execution_failed: workflowId=wf-failure workflowNodeId=a reason=boom');
  });

  it('T-WR7 runs simple linear workflow for backward-compatible sequential pattern', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-linear',
      nodes: [
        { id: 'one', task: 'task-1' },
        { id: 'two', task: 'task-2', dependsOn: ['one'] },
        { id: 'three', task: 'task-3', dependsOn: ['two'] }
      ]
    });

    const result = await runWorkflow({
      missionId: 'mission-7',
      workflow,
      executor: {
        execute(input) {
          return { completed: input.workflowNodeId };
        }
      }
    });

    expect(result.executionOrder).toEqual(['one', 'two', 'three']);
    expect(result.nodeResults.map((entry) => entry.workflowNodeId)).toEqual(['one', 'two', 'three']);
  });
});
