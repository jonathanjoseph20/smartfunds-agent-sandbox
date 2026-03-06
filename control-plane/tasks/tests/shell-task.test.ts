import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createExecutionContext } from '../../execution/execution-context.ts';
import { shellTaskAdapter } from '../adapters/shell-task.ts';
import type { TaskContext } from '../task-context.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-shell-task-adapter');

function resetTmpRoot(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
}

function context(inputs: Record<string, unknown>): TaskContext {
  return {
    runId: 'run_control-plane_0001',
    phase: 'verify',
    taskId: 'task_shell',
    taskType: 'shell',
    inputs,
    executionContext: createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'verify',
      taskId: 'task_shell'
    })
  };
}

beforeEach(() => {
  resetTmpRoot();
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('shell task adapter', () => {
  it('captures stdout for successful commands', async () => {
    const result = await shellTaskAdapter.execute(context({
      command: 'printf',
      args: ['ok\n']
    }));

    expect(result.status).toBe('success');
    expect(result.outputs).toEqual({
      stdout: 'ok\n',
      stderr: '',
      exitCode: 0
    });
  });

  it('returns deterministic failure for non-zero exit codes', async () => {
    const result = await shellTaskAdapter.execute(context({
      command: 'sh',
      args: ['-c', 'printf bad >&2; exit 2']
    }));

    expect(result).toEqual({
      status: 'failed',
      outputs: {
        stdout: '',
        stderr: 'bad',
        exitCode: 2
      },
      artifacts: [],
      logs: ['SHELL_TASK_EXECUTED: sh'],
      errorCode: 'ERR_SHELL_COMMAND_FAILED',
      errorMessage: 'Shell command failed with exit code 2.'
    });
  });

  it('returns deterministic failure when command is missing', async () => {
    const result = await shellTaskAdapter.execute(context({ args: [] }));

    expect(result).toEqual({
      status: 'failed',
      outputs: {},
      artifacts: [],
      logs: ['SHELL_TASK_FAILED'],
      errorCode: 'ERR_SHELL_COMMAND_REQUIRED',
      errorMessage: 'Shell command is required.'
    });
  });

  it('handles relative cwd deterministically', async () => {
    const result = await shellTaskAdapter.execute(context({
      command: 'pwd',
      cwd: tmpRoot
    }));

    expect(result.status).toBe('success');
    expect(result.outputs).toEqual({
      stdout: `${path.resolve(process.cwd(), tmpRoot)}\n`,
      stderr: '',
      exitCode: 0
    });
  });

  it('produces stable outputs for same inputs', async () => {
    const first = await shellTaskAdapter.execute(context({
      command: 'printf',
      args: ['repeat\n']
    }));

    const second = await shellTaskAdapter.execute(context({
      command: 'printf',
      args: ['repeat\n']
    }));

    expect(first).toEqual(second);
  });
});
