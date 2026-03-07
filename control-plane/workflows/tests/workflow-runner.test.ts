import { describe, expect, it, vi } from 'vitest';

import { loadWorkflowDefinition } from '../workflow-loader.ts';
import { runWorkflow, runWorkflowWithHardening, type WorkflowTaskExecutor } from '../workflow-runner.ts';

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

  it('T-WR8 retries failed node deterministically in hardened path', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-hardening',
      nodes: [
        { id: 'node1', task: 'task-1' },
        { id: 'node2', task: 'task-2', dependsOn: ['node1'] }
      ]
    });

    const calls = new Map<string, number>();
    const runtimeEvents: string[] = [];
    const executor: WorkflowTaskExecutor = {
      execute(input) {
        const count = (calls.get(input.workflowNodeId) ?? 0) + 1;
        calls.set(input.workflowNodeId, count);

        if (input.workflowNodeId === 'node2' && count === 1) {
          throw new Error('ADAPTER_TIMEOUT');
        }

        return { ok: input.workflowNodeId };
      }
    };

    const result = await runWorkflowWithHardening({
      missionId: 'mission-hardening',
      workflow,
      executor,
      hardening: {
        onRuntimeEvent(event) {
          runtimeEvents.push(event.type);
        }
      }
    });

    expect(result.executionOrder).toEqual(['node1', 'node2']);
    expect(calls.get('node2')).toBe(2);
    expect(runtimeEvents).toEqual([
      'ADAPTER_TIMEOUT',
      'NODE_RETRY_SCHEDULED',
      'NODE_RETRY_STARTED'
    ]);
  });

  it('T-WR9 enforces timeout policy with deterministic elapsed resolver', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-timeout',
      nodes: [{ id: 'node-a', task: 'task-a' }]
    });

    const runtimeEvents: string[] = [];
    await expect(runWorkflowWithHardening({
      missionId: 'mission-timeout',
      workflow,
      executor: {
        execute() {
          throw new Error('timeout-simulated');
        }
      },
      hardening: {
        timeoutPolicy: {
          nodeTimeoutSeconds: 1,
          adapterTimeoutSeconds: 5,
          workflowTimeoutSeconds: 10
        },
        resolveElapsedSeconds(input) {
          if (input.kind === 'node') {
            return 2;
          }
          return input.tick;
        },
        onRuntimeEvent(event) {
          runtimeEvents.push(event.type);
        }
      }
    })).rejects.toThrow('workflow.execution_failed: workflowId=wf-timeout workflowNodeId=node-a');

    expect(runtimeEvents[0]).toBe('NODE_TIMEOUT');
  });

  it('T-WR10 emits deterministic safety limit violation and stops execution', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-safety',
      nodes: [{ id: 'node-a', task: 'task-a' }]
    });
    const runtimeEvents: string[] = [];

    await expect(runWorkflowWithHardening({
      missionId: 'mission-safety',
      workflow,
      executor: {
        execute() {
          return { ok: true };
        }
      },
      hardening: {
        safetyLimits: {
          maxNodesPerWorkflow: 50,
          maxWorkflowRuntimeSeconds: 0,
          maxRetriesPerNode: 3,
          maxTotalRetriesPerWorkflow: 25,
          maxContextSize: 100000
        },
        onRuntimeEvent(event) {
          runtimeEvents.push(event.type);
        }
      }
    })).rejects.toThrow('workflow.safety_limit_violation: workflowId=wf-safety');

    expect(runtimeEvents).toContain('SAFETY_LIMIT_VIOLATION');
  });

  it('T-WR11 resume state skips completed nodes deterministically', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-resume',
      nodes: [
        { id: 'node1', task: 'task-1' },
        { id: 'node2', task: 'task-2', dependsOn: ['node1'] },
        { id: 'node3', task: 'task-3', dependsOn: ['node2'] }
      ]
    });
    const seen: string[] = [];

    const result = await runWorkflowWithHardening({
      missionId: 'mission-resume',
      workflow,
      executor: {
        execute(input) {
          seen.push(input.workflowNodeId);
          return { ok: input.workflowNodeId };
        }
      },
      hardening: {
        initialState: {
          completedNodeIds: ['node1'],
          outputsByNodeId: { node1: { ok: 'node1' } },
          retriesByNodeId: {},
          currentTick: 4
        }
      }
    });

    expect(seen).toEqual(['node2', 'node3']);
    expect(result.executionOrder).toEqual(['node2', 'node3']);
  });
});
