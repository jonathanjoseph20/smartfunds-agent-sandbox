import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createExecutionContext } from '../../execution/execution-context.ts';
import { repoTaskAdapter } from '../adapters/repo-task.ts';
import type { TaskContext } from '../task-context.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-repo-task-adapter');

function resetTmpRoot(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
}

function context(inputs: Record<string, unknown>): TaskContext {
  return {
    runId: 'run_control-plane_0001',
    phase: 'implement',
    taskId: 'task_repo',
    taskType: 'repo',
    inputs,
    executionContext: createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'implement',
      taskId: 'task_repo'
    })
  };
}

beforeEach(() => {
  resetTmpRoot();
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('repo task adapter', () => {
  it('reads file content deterministically', async () => {
    const filePath = path.join(tmpRoot, 'read.txt');
    fs.writeFileSync(filePath, 'hello\n', 'utf8');

    const result = await repoTaskAdapter.execute(context({
      operation: 'read_file',
      path: filePath
    }));

    expect(result.status).toBe('success');
    expect(result.outputs).toEqual({
      operation: 'read_file',
      path: filePath,
      content: 'hello\n'
    });
  });

  it('returns deterministic failure when read target does not exist', async () => {
    const result = await repoTaskAdapter.execute(context({
      operation: 'read_file',
      path: path.join(tmpRoot, 'missing.txt')
    }));

    expect(result.errorCode).toBe('ERR_REPO_FILE_NOT_FOUND');
  });

  it('creates file with deterministic result', async () => {
    const relativePath = path.join(tmpRoot, 'create.txt');

    const result = await repoTaskAdapter.execute(context({
      operation: 'create_file',
      path: relativePath,
      content: 'create-content'
    }));

    expect(result).toEqual({
      status: 'success',
      outputs: {
        operation: 'create_file',
        path: relativePath,
        bytesWritten: 14
      },
      artifacts: [],
      logs: ['REPO_TASK_EXECUTED: create_file']
    });
    expect(fs.readFileSync(relativePath, 'utf8')).toBe('create-content');
  });

  it('fails create_file when target already exists', async () => {
    const relativePath = path.join(tmpRoot, 'existing.txt');
    fs.writeFileSync(relativePath, 'existing', 'utf8');

    const result = await repoTaskAdapter.execute(context({
      operation: 'create_file',
      path: relativePath,
      content: 'new-content'
    }));

    expect(result.errorCode).toBe('ERR_REPO_FILE_EXISTS');
  });

  it('writes file deterministically', async () => {
    const relativePath = path.join(tmpRoot, 'write.txt');
    fs.writeFileSync(relativePath, 'old', 'utf8');

    const result = await repoTaskAdapter.execute(context({
      operation: 'write_file',
      path: relativePath,
      content: 'new-content'
    }));

    expect(result).toEqual({
      status: 'success',
      outputs: {
        operation: 'write_file',
        path: relativePath,
        bytesWritten: 11
      },
      artifacts: [],
      logs: ['REPO_TASK_EXECUTED: write_file']
    });
    expect(fs.readFileSync(relativePath, 'utf8')).toBe('new-content');
  });

  it('lists directory entries in sorted order', async () => {
    fs.writeFileSync(path.join(tmpRoot, 'z.txt'), 'z', 'utf8');
    fs.writeFileSync(path.join(tmpRoot, 'a.txt'), 'a', 'utf8');
    fs.mkdirSync(path.join(tmpRoot, 'm-dir'), { recursive: true });

    const result = await repoTaskAdapter.execute(context({
      operation: 'list_dir',
      path: tmpRoot
    }));

    expect(result.status).toBe('success');
    expect(result.outputs).toEqual({
      operation: 'list_dir',
      path: tmpRoot,
      entries: [
        { name: 'a.txt', kind: 'file' },
        { name: 'm-dir', kind: 'dir' },
        { name: 'z.txt', kind: 'file' }
      ]
    });
  });

  it('rejects absolute paths', async () => {
    const absolutePath = path.resolve(process.cwd(), tmpRoot, 'a.txt');
    const result = await repoTaskAdapter.execute(context({
      operation: 'read_file',
      path: absolutePath
    }));

    expect(result.errorCode).toBe('ERR_REPO_PATH_ABSOLUTE');
  });

  it('rejects traversal outside repo root', async () => {
    const result = await repoTaskAdapter.execute(context({
      operation: 'read_file',
      path: '../outside.txt'
    }));

    expect(result.errorCode).toBe('ERR_REPO_PATH_TRAVERSAL');
  });

  it('rejects unsupported operations', async () => {
    const result = await repoTaskAdapter.execute(context({
      operation: 'delete_file',
      path: tmpRoot
    }));

    expect(result.errorCode).toBe('ERR_REPO_OPERATION_UNSUPPORTED');
  });

  it('returns deterministic outputs for same input', async () => {
    const filePath = path.join(tmpRoot, 'stable.txt');
    fs.writeFileSync(filePath, 'stable', 'utf8');

    const first = await repoTaskAdapter.execute(context({
      operation: 'read_file',
      path: filePath
    }));

    const second = await repoTaskAdapter.execute(context({
      operation: 'read_file',
      path: filePath
    }));

    expect(first).toEqual(second);
  });
});
