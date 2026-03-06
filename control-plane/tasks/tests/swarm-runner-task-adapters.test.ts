import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createExecutionJournal } from '../../journal/journal.ts';
import { createSwarmRunner } from '../../swarm/swarm-runner.ts';
import { llmTaskAdapter } from '../adapters/llm-task.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-swarm-task-adapters');

function resetTmpRoot(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
}

beforeEach(() => {
  resetTmpRoot();
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('swarm runner task adapter integration', () => {
  it('resolves adapters by task type and emits deterministic task lifecycle events', async () => {
    const executeSpy = vi.spyOn(llmTaskAdapter, 'execute');

    const runner = createSwarmRunner({ rootDir: tmpRoot });
    const created = runner.createSwarmRun({ projectId: 'control-plane' });

    const finalSummary = await runner.executeSwarmRun({ runId: created.runId });
    const journal = createExecutionJournal({ rootDir: tmpRoot });
    const inspected = journal.inspectRun(created.runId);

    expect(finalSummary.status).toBe('completed');
    expect(executeSpy).toHaveBeenCalled();

    const firstCall = executeSpy.mock.calls[0][0];
    expect(firstCall).toMatchObject({
      runId: created.runId,
      phase: 'setup',
      taskId: 'load-run-context',
      taskType: 'llm',
      inputs: {
        prompt: 'Load deterministic run context'
      },
      executionContext: {}
    });

    const taskStarted = inspected.events.find((event) => event.type === 'TASK_STARTED' && event.taskId === 'load-run-context');
    const taskCompleted = inspected.events.find((event) => event.type === 'TASK_COMPLETED' && event.taskId === 'load-run-context');

    expect(taskStarted?.payload).toEqual({
      runId: created.runId,
      taskType: 'llm',
      inputs: {
        prompt: 'Load deterministic run context'
      }
    });

    expect(taskCompleted?.payload).toEqual({
      runId: created.runId,
      taskType: 'llm',
      result: {
        status: 'success',
        outputs: {
          response: 'stub:deterministic-stub-model:Load deterministic run context',
          mode: 'stub'
        },
        artifacts: [],
        logs: ['LLM_TASK_EXECUTED_STUB_MODE']
      }
    });
  });

  it('emits TASK_FAILED and RUN_FAILED when adapter returns failed result', async () => {
    vi.spyOn(llmTaskAdapter, 'execute').mockResolvedValueOnce({
      status: 'failed',
      outputs: {},
      artifacts: [],
      logs: ['LLM_TASK_FAILED'],
      errorCode: 'ERR_TEST_FAILURE',
      errorMessage: 'forced-failure'
    });

    const runner = createSwarmRunner({ rootDir: tmpRoot });
    const created = runner.createSwarmRun({ projectId: 'control-plane' });

    const finalSummary = await runner.executeSwarmRun({ runId: created.runId });
    const journal = createExecutionJournal({ rootDir: tmpRoot });
    const inspected = journal.inspectRun(created.runId);

    expect(finalSummary.status).toBe('failed');
    expect(finalSummary.failedPhase).toBe('setup');

    const failedEvent = inspected.events.find((event) => event.type === 'TASK_FAILED' && event.taskId === 'load-run-context');
    expect(failedEvent?.payload).toEqual({
      runId: created.runId,
      taskType: 'llm',
      result: {
        status: 'failed',
        outputs: {},
        artifacts: [],
        logs: ['LLM_TASK_FAILED'],
        errorCode: 'ERR_TEST_FAILURE',
        errorMessage: 'forced-failure'
      },
      error: 'forced-failure'
    });

    expect(inspected.events[inspected.events.length - 1].type).toBe('RUN_FAILED');
  });
});
