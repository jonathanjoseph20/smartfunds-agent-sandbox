import { describe, expect, it } from 'vitest';

import type { ExecutionJournal } from '../../journal/journal.ts';
import type { ExecutionEvent, ExecutionRun } from '../../journal/types.ts';
import { buildWorkflowRunRecord } from '../../observability/run-record.ts';
import { buildWorkflowTrace } from '../../observability/trace-builder.ts';
import { loadWorkflowDefinition } from '../../workflows/workflow-loader.ts';
import {
  deriveResumeStateFromJournal,
  executeWorkflowRunWithHardening
} from '../hardened-workflow-runtime.ts';

function createMemoryJournal(input: { runId: string }): {
  journal: ExecutionJournal;
  run: ExecutionRun;
  events: ExecutionEvent[];
} {
  const events: ExecutionEvent[] = [];
  const run: ExecutionRun = {
    runId: input.runId,
    projectId: 'control-plane',
    entity: 'core-entity',
    pod: 'smartfunds',
    mode: 'structured',
    kind: 'mission',
    status: 'pending',
    entrypoint: 'workflow:wf-hardening',
    createdIndex: 1
  };

  const journal: ExecutionJournal = {
    createRun() {
      throw new Error('not-used');
    },
    appendEvent(eventInput) {
      const next: ExecutionEvent = {
        runId: eventInput.runId,
        eventId: `evt_${events.length + 1}`,
        sequence: events.length + 1,
        type: eventInput.type,
        phase: eventInput.phase,
        taskId: eventInput.taskId ?? null,
        artifactId: eventInput.artifactId ?? null,
        payload: eventInput.payload ?? {}
      };
      events.push(next);
      return next;
    },
    inspectRun() {
      return {
        run,
        events: [...events]
      };
    },
    summarizeRun() {
      throw new Error('not-used');
    },
    listRuns() {
      return [run];
    }
  };

  return { journal, run, events };
}

describe('hardened workflow runtime integration', () => {
  it('T-HWI1 runs retry path through canonical hardened runtime with observability events', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-hardening',
      nodes: [
        { id: 'node1', task: 'task-1' },
        { id: 'node2', task: 'task-2', dependsOn: ['node1'] },
        { id: 'node3', task: 'task-3', dependsOn: ['node2'] }
      ]
    });
    const { journal, run, events } = createMemoryJournal({ runId: 'run_control-plane_0101' });
    const attempts = new Map<string, number>();

    const result = await executeWorkflowRunWithHardening({
      journal,
      runId: run.runId,
      missionId: 'mission-1',
      workflow,
      executor: {
        execute(input) {
          const attempt = (attempts.get(input.workflowNodeId) ?? 0) + 1;
          attempts.set(input.workflowNodeId, attempt);
          if (input.workflowNodeId === 'node2' && attempt === 1) {
            throw new Error('ADAPTER_EXECUTION_FAILED');
          }
          return { done: input.workflowNodeId };
        }
      }
    });

    expect(result.executionOrder).toEqual(['node1', 'node2', 'node3']);
    expect(events.map((event) => event.type)).toEqual([
      'TASK_STARTED',
      'TASK_COMPLETED',
      'TASK_STARTED',
      'TASK_FAILED',
      'NODE_RETRY_SCHEDULED',
      'NODE_RETRY_STARTED',
      'TASK_STARTED',
      'TASK_COMPLETED',
      'TASK_STARTED',
      'TASK_COMPLETED',
      'RUN_COMPLETED'
    ]);

    const runRecord = buildWorkflowRunRecord({ run, events });
    const trace = buildWorkflowTrace({
      runId: run.runId,
      workflowId: workflow.workflowId,
      events
    });
    expect(runRecord.retryCount).toBe(1);
    expect(runRecord.summary.totalRetriesConsumed).toBe(1);
    expect(trace.some((entry) => entry.type === 'NODE_RETRY_SCHEDULED')).toBe(true);
    expect(trace.some((entry) => entry.type === 'NODE_RETRY_STARTED')).toBe(true);
  });

  it('T-HWI2 classifies timeout and retries deterministically in canonical runtime', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-timeout',
      nodes: [
        { id: 'node1', task: 'task-1' },
        { id: 'node2', task: 'task-2', dependsOn: ['node1'] }
      ]
    });
    const { journal, run, events } = createMemoryJournal({ runId: 'run_control-plane_0102' });
    let node2Attempts = 0;

    await executeWorkflowRunWithHardening({
      journal,
      runId: run.runId,
      missionId: 'mission-2',
      workflow,
      executor: {
        execute(input) {
          if (input.workflowNodeId === 'node2') {
            node2Attempts += 1;
            if (node2Attempts === 1) {
              throw new Error('timeout elapsed=2');
            }
          }
          return { done: input.workflowNodeId };
        }
      },
      hardening: {
        timeoutPolicy: {
          nodeTimeoutSeconds: 1,
          adapterTimeoutSeconds: 10,
          workflowTimeoutSeconds: 100
        }
      }
    });

    expect(node2Attempts).toBe(2);
    expect(events.map((event) => event.type)).toContain('NODE_TIMEOUT');
    expect(events.map((event) => event.type)).toContain('NODE_RETRY_SCHEDULED');
    expect(events.map((event) => event.type)).toContain('NODE_RETRY_STARTED');
    const trace = buildWorkflowTrace({
      runId: run.runId,
      workflowId: workflow.workflowId,
      events
    });
    expect(trace.some((entry) => entry.type === 'NODE_TIMEOUT')).toBe(true);
  });

  it('T-HWI3 emits safety limit violation and halts deterministically', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-safety',
      nodes: [{ id: 'node1', task: 'task-1' }]
    });
    const { journal, events } = createMemoryJournal({ runId: 'run_control-plane_0103' });

    await expect(executeWorkflowRunWithHardening({
      journal,
      runId: 'run_control-plane_0103',
      missionId: 'mission-3',
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
        }
      }
    })).rejects.toThrow('workflow.safety_limit_violation: workflowId=wf-safety');

    expect(events.map((event) => event.type)).toEqual(['SAFETY_LIMIT_VIOLATION', 'RUN_FAILED']);
  });

  it('T-HWI4 resumes via hardened runtime and skips completed nodes', async () => {
    const workflow = loadWorkflowDefinition({
      workflowId: 'wf-recovery',
      nodes: [
        { id: 'node1', task: 'task-1' },
        { id: 'node2', task: 'task-2', dependsOn: ['node1'] },
        { id: 'node3', task: 'task-3', dependsOn: ['node2'] }
      ]
    });
    const { journal, run, events } = createMemoryJournal({ runId: 'run_control-plane_0104' });

    journal.appendEvent({
      runId: run.runId,
      type: 'TASK_STARTED',
      phase: 'implement',
      taskId: 'node1',
      payload: {
        context_snapshot: { metadata: { workflowId: workflow.workflowId } }
      }
    });
    journal.appendEvent({
      runId: run.runId,
      type: 'TASK_COMPLETED',
      phase: 'implement',
      taskId: 'node1',
      payload: {
        task_outputs: { output: { done: 'node1' } },
        context_snapshot: { metadata: { workflowId: workflow.workflowId } }
      }
    });
    journal.appendEvent({
      runId: run.runId,
      type: 'TASK_STARTED',
      phase: 'implement',
      taskId: 'node2',
      payload: {
        context_snapshot: { metadata: { workflowId: workflow.workflowId } }
      }
    });
    journal.appendEvent({
      runId: run.runId,
      type: 'TASK_FAILED',
      phase: 'implement',
      taskId: 'node2',
      payload: {
        error: 'ADAPTER_EXECUTION_FAILED',
        context_snapshot: { metadata: { workflowId: workflow.workflowId } }
      }
    });
    journal.appendEvent({
      runId: run.runId,
      type: 'RUN_FAILED',
      phase: 'implement',
      taskId: 'node2',
      payload: {
        error: 'workflow.execution_failed'
      }
    });

    const derived = deriveResumeStateFromJournal({
      runId: run.runId,
      workflowId: workflow.workflowId,
      events
    });
    const seen: string[] = [];

    await executeWorkflowRunWithHardening({
      journal,
      runId: run.runId,
      missionId: 'mission-4',
      workflow,
      executor: {
        execute(input) {
          seen.push(input.workflowNodeId);
          return { done: input.workflowNodeId };
        }
      },
      hardening: {
        initialState: derived.initialState
      }
    });

    expect(seen).toEqual(['node2', 'node3']);
  });
});
