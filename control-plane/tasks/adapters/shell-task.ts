import { execFile } from 'node:child_process';
import path from 'node:path';

import type { AgentTaskAdapter } from '../adapter-interface.ts';
import type { TaskResult } from '../task-result.ts';

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function failedResult(errorCode: string, errorMessage: string): TaskResult {
  return {
    status: 'failed',
    outputs: {},
    artifacts: [],
    logs: ['SHELL_TASK_FAILED'],
    errorCode,
    errorMessage
  };
}

export const shellTaskAdapter: AgentTaskAdapter = {
  type: 'shell',
  async execute(context) {
    const command = context.inputs.command;
    if (typeof command !== 'string' || command.trim().length === 0) {
      return failedResult('ERR_SHELL_COMMAND_REQUIRED', 'Shell command is required.');
    }

    const argsInput = context.inputs.args;
    const args = Array.isArray(argsInput) ? argsInput.filter((value): value is string => typeof value === 'string') : [];

    const cwdInput = context.inputs.cwd;
    const cwd = typeof cwdInput === 'string' && cwdInput.trim().length > 0
      ? path.resolve(process.cwd(), cwdInput)
      : process.cwd();

    const envInput = context.inputs.env;
    const env = typeof envInput === 'object' && envInput !== null && !Array.isArray(envInput)
      ? Object.fromEntries(
        Object.entries(envInput).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
      : {};

    const execution = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      execFile(command, args, {
        cwd,
        env: {
          ...process.env,
          ...env
        },
        encoding: 'utf8'
      }, (error, stdout, stderr) => {
        if (!error) {
          resolve({
            stdout: stdout ?? '',
            stderr: stderr ?? '',
            exitCode: 0
          });
          return;
        }

        const exitCode = typeof error.code === 'number' ? error.code : 1;
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? error.message,
          exitCode
        });
      });
    });

    const normalizedStdout = normalizeText(execution.stdout);
    const normalizedStderr = normalizeText(execution.stderr);

    if (execution.exitCode !== 0) {
      return {
        status: 'failed',
        outputs: {
          stdout: normalizedStdout,
          stderr: normalizedStderr,
          exitCode: execution.exitCode
        },
        artifacts: [],
        logs: [`SHELL_TASK_EXECUTED: ${command}`],
        errorCode: 'ERR_SHELL_COMMAND_FAILED',
        errorMessage: `Shell command failed with exit code ${execution.exitCode}.`
      };
    }

    return {
      status: 'success',
      outputs: {
        stdout: normalizedStdout,
        stderr: normalizedStderr,
        exitCode: execution.exitCode
      },
      artifacts: [],
      logs: [`SHELL_TASK_EXECUTED: ${command}`]
    };
  }
};
