import { execFileSync } from 'node:child_process';

export type GitExec = (args: string[]) => string;

export function normalizeChangedFiles(paths: string[]): string[] {
  return Array.from(new Set(paths.map((entry) => entry.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function defaultGitExec(args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    const stdout = (error as { stdout?: string | Buffer }).stdout;
    if (typeof stdout === 'string') {
      return stdout.trim();
    }
    if (Buffer.isBuffer(stdout)) {
      return stdout.toString('utf8').trim();
    }
    throw error;
  }
}

function splitGitOutput(output: string): string[] {
  if (!output) {
    return [];
  }
  return normalizeChangedFiles(output.split('\n'));
}

export function getChangedFilesFromMain(execGit: GitExec): string[] {
  return splitGitOutput(execGit(['diff', '--name-only', 'main...HEAD']));
}

export function getChangedFilesFromBase(execGit: GitExec, baseSha: string): string[] {
  return splitGitOutput(execGit(['diff', '--name-only', baseSha, 'HEAD']));
}
