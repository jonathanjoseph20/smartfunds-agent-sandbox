import fs from 'node:fs';
import path from 'node:path';

import type { AgentTaskAdapter } from '../adapter-interface.ts';
import type { TaskResult } from '../task-result.ts';

const SUPPORTED_OPERATIONS = ['read_file', 'write_file', 'create_file', 'list_dir'] as const;
type RepoOperation = (typeof SUPPORTED_OPERATIONS)[number];

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function failedResult(errorCode: string, errorMessage: string): TaskResult {
  return {
    status: 'failed',
    outputs: {},
    artifacts: [],
    logs: ['REPO_TASK_FAILED'],
    errorCode,
    errorMessage
  };
}

function isRepoOperation(value: unknown): value is RepoOperation {
  return typeof value === 'string' && SUPPORTED_OPERATIONS.includes(value as RepoOperation);
}

function resolveSafePath(relativePath: string): { ok: true; resolved: string } | { ok: false; error: TaskResult } {
  if (path.isAbsolute(relativePath)) {
    return {
      ok: false,
      error: failedResult('ERR_REPO_PATH_ABSOLUTE', 'Absolute paths are not allowed.')
    };
  }

  const repoRoot = process.cwd();
  const resolved = path.resolve(repoRoot, relativePath);
  const relative = path.relative(repoRoot, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return {
      ok: false,
      error: failedResult('ERR_REPO_PATH_TRAVERSAL', 'Path escapes repository root.')
    };
  }

  return {
    ok: true,
    resolved
  };
}

export const repoTaskAdapter: AgentTaskAdapter = {
  type: 'repo',
  async execute(context) {
    const operation = context.inputs.operation;
    const inputPath = context.inputs.path;

    if (!isRepoOperation(operation)) {
      return failedResult('ERR_REPO_OPERATION_UNSUPPORTED', 'Unsupported repository operation.');
    }

    if (typeof inputPath !== 'string' || inputPath.trim().length === 0) {
      return failedResult('ERR_REPO_PATH_REQUIRED', 'Repository operation path is required.');
    }

    const safePath = resolveSafePath(inputPath);
    if (!safePath.ok) {
      return safePath.error;
    }

    const resolvedPath = safePath.resolved;

    try {
      if (operation === 'read_file') {
        if (!fs.existsSync(resolvedPath)) {
          return failedResult('ERR_REPO_FILE_NOT_FOUND', `File not found: ${inputPath}`);
        }

        const content = normalizeText(fs.readFileSync(resolvedPath, 'utf8'));
        return {
          status: 'success',
          outputs: {
            operation,
            path: inputPath,
            content
          },
          artifacts: [],
          logs: [`REPO_TASK_EXECUTED: ${operation}`]
        };
      }

      if (operation === 'create_file') {
        if (fs.existsSync(resolvedPath)) {
          return failedResult('ERR_REPO_FILE_EXISTS', `File already exists: ${inputPath}`);
        }

        const content = typeof context.inputs.content === 'string' ? context.inputs.content : '';
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        fs.writeFileSync(resolvedPath, content, 'utf8');

        return {
          status: 'success',
          outputs: {
            operation,
            path: inputPath,
            bytesWritten: Buffer.byteLength(content, 'utf8')
          },
          artifacts: [],
          logs: [`REPO_TASK_EXECUTED: ${operation}`]
        };
      }

      if (operation === 'write_file') {
        const content = typeof context.inputs.content === 'string' ? context.inputs.content : '';
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        fs.writeFileSync(resolvedPath, content, 'utf8');

        return {
          status: 'success',
          outputs: {
            operation,
            path: inputPath,
            bytesWritten: Buffer.byteLength(content, 'utf8')
          },
          artifacts: [],
          logs: [`REPO_TASK_EXECUTED: ${operation}`]
        };
      }

      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true })
        .map((entry) => ({
          name: entry.name,
          kind: entry.isDirectory() ? 'dir' : 'file'
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      return {
        status: 'success',
        outputs: {
          operation,
          path: inputPath,
          entries
        },
        artifacts: [],
        logs: [`REPO_TASK_EXECUTED: ${operation}`]
      };
    } catch (error) {
      const message = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Repository operation failed.';
      return failedResult('ERR_REPO_OPERATION_FAILED', message);
    }
  }
};
