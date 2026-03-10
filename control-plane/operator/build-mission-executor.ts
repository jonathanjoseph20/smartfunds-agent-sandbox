import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { mutationKernel } from '../pr/mutationKernel.ts';

type BuildMutation = {
  path: string;
  content: string;
};

type BuildCheck = {
  command: string;
  args?: string[];
};

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = (command: string, args: string[]) => CommandResult;

export type BuildMissionExecutionInput = {
  missionId: string;
  runId: string;
  targetRepo: string;
  targetPaths: string[];
  mutationPlan: BuildMutation[];
  checks: BuildCheck[];
};

export type BuildMissionExecutionResult = {
  branchName: string;
  prNumber?: number;
  prUrl?: string;
  mutationSummary: string[];
};

const DEFAULT_BASE_BRANCH = 'main';
const DEFAULT_COMMIT_MESSAGE_PREFIX = 'feat(build): ';

const PROTECTED_PATH_PREFIXES = [
  'control-plane/',
  'entities/',
  'runtime/',
  'policies/'
] as const;

const FORBIDDEN_STAGE_PREFIXES = ['artifacts/', '.tmp/', 'runtime-data/'] as const;
const FORBIDDEN_STAGE_SUFFIXES = ['/run-metadata.json', 'run-metadata.json'] as const;

function defaultCommandRunner(command: string, args: string[]): CommandResult {
  try {
    const stdout = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    return {
      code: 0,
      stdout: stdout ?? '',
      stderr: ''
    };
  } catch (error) {
    const execError = error as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      code: execError.status ?? 1,
      stdout: typeof execError.stdout === 'string'
        ? execError.stdout
        : Buffer.isBuffer(execError.stdout)
          ? execError.stdout.toString('utf8')
          : '',
      stderr: typeof execError.stderr === 'string'
        ? execError.stderr
        : Buffer.isBuffer(execError.stderr)
          ? execError.stderr.toString('utf8')
          : ''
    };
  }
}

function runOrFail(runner: CommandRunner, command: string, args: string[], codeOnFailure: string): CommandResult {
  const result = runner(command, args);
  if (result.code !== 0) {
    throw new Error(codeOnFailure);
  }
  return result;
}

function normalizeRepoPath(pathValue: string): string {
  return pathValue.replaceAll('\\', '/').trim();
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isSafePath(pathValue: string): boolean {
  return pathValue.length > 0
    && !pathValue.startsWith('/')
    && !pathValue.includes('..')
    && !pathValue.includes('\\');
}

function isProtectedPath(pathValue: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathValue.startsWith(prefix));
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(glob: string): RegExp {
  const escaped = escapeRegex(glob);
  const pattern = escaped
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');
  return new RegExp(`^${pattern}$`);
}

function pathMatchesAllowed(pathValue: string, allowedPatterns: string[]): boolean {
  return allowedPatterns.some((pattern) => globToRegExp(pattern).test(pathValue));
}

function buildBranchName(input: { missionId: string; runId: string; targetRepo: string; targetPaths: string[] }): string {
  const mission = input.missionId.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'mission';
  const hash = sha256(canonicalStringify({
    missionId: input.missionId,
    runId: input.runId,
    targetRepo: input.targetRepo,
    targetPaths: [...input.targetPaths].sort((left, right) => left.localeCompare(right))
  })).slice(0, 12);
  return `build/${mission}/${hash}`;
}

function branchExists(runner: CommandRunner, branchName: string): boolean {
  const local = runner('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
  if (local.code === 0) {
    return true;
  }

  const remote = runner('git', ['ls-remote', '--heads', 'origin', branchName]);
  if (remote.code !== 0) {
    return false;
  }
  return remote.stdout.trim().length > 0;
}

function parsePrNumber(output: string): number | undefined {
  const lines = output.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  for (const line of lines) {
    const match = line.match(/\/pull\/(\d+)/);
    if (!match) {
      continue;
    }
    const parsed = Number.parseInt(match[1] as string, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

function parsePrView(output: string): { number?: number; url?: string; body?: string } {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as { number?: unknown; url?: unknown; body?: unknown };
    return {
      ...(typeof parsed.number === 'number' ? { number: parsed.number } : {}),
      ...(typeof parsed.url === 'string' ? { url: parsed.url } : {}),
      ...(typeof parsed.body === 'string' ? { body: parsed.body } : {})
    };
  } catch {
    return {
      ...(parsePrNumber(trimmed) ? { number: parsePrNumber(trimmed) } : {})
    };
  }
}

function writePrBodyFile(runId: string, body: string): string {
  fs.mkdirSync('.tmp', { recursive: true });
  const filePath = path.join('.tmp', `build-run-${runId}.pr-body.md`);
  fs.writeFileSync(filePath, `${body.replace(/\r\n?/g, '\n').replace(/\n*$/, '')}\n`, 'utf8');
  return filePath;
}

function ensureMutationsAllowed(input: { mutations: BuildMutation[]; targetPaths: string[] }): BuildMutation[] {
  if (input.mutations.length === 0) {
    throw new Error('BUILD_TARGET_SCOPE_DENIED');
  }

  const normalized = input.mutations
    .map((mutation) => ({
      path: normalizeRepoPath(mutation.path),
      content: mutation.content
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  const duplicates = normalized
    .map((entry) => entry.path)
    .filter((entry, index, list) => list.indexOf(entry) !== index);
  if (duplicates.length > 0) {
    throw new Error('BUILD_TARGET_SCOPE_DENIED');
  }

  for (const mutation of normalized) {
    if (!isSafePath(mutation.path)) {
      throw new Error('BUILD_TARGET_SCOPE_DENIED');
    }
    if (isProtectedPath(mutation.path)) {
      throw new Error('BUILD_PROTECTED_SCOPE_FORBIDDEN');
    }
    if (!pathMatchesAllowed(mutation.path, input.targetPaths)) {
      throw new Error('BUILD_TARGET_SCOPE_DENIED');
    }
  }

  return normalized;
}

function ensureNoForbiddenStagedFiles(stagedFiles: string[]): void {
  const normalized = stagedFiles.map((entry) => normalizeRepoPath(entry)).filter((entry) => entry.length > 0);
  const forbidden = normalized.find((entry) => {
    if (FORBIDDEN_STAGE_PREFIXES.some((prefix) => entry.startsWith(prefix))) {
      return true;
    }
    return FORBIDDEN_STAGE_SUFFIXES.some((suffix) => entry === suffix || entry.endsWith(suffix));
  });

  if (forbidden) {
    throw new Error('BUILD_PROTECTED_SCOPE_FORBIDDEN');
  }
}

function ensureOnlyExpectedStagedFiles(stagedFiles: string[], expectedFiles: string[]): void {
  const normalizedStaged = sortedUnique(stagedFiles.map((entry) => normalizeRepoPath(entry)).filter((entry) => entry.length > 0));
  const normalizedExpected = sortedUnique(expectedFiles.map((entry) => normalizeRepoPath(entry)));

  if (canonicalStringify(normalizedStaged) !== canonicalStringify(normalizedExpected)) {
    throw new Error('BUILD_TARGET_SCOPE_DENIED');
  }
}

function runChecks(runner: CommandRunner, checks: BuildCheck[]): void {
  for (const check of [...checks].sort((left, right) => left.command.localeCompare(right.command))) {
    const args = Array.isArray(check.args) ? [...check.args] : [];
    runOrFail(runner, check.command, args, 'BUILD_TARGET_SCOPE_DENIED');
  }
}

function buildProvenanceBody(input: {
  currentBody: string;
  missionId: string;
  runId: string;
  targetRepo: string;
  targetPaths: string[];
  branchName: string;
  mutationSummary: string[];
}): string {
  const evidenceFields = Object.fromEntries(Object.entries({
    'Mission ID': input.missionId,
    'Run ID': input.runId,
    'Profile': 'build',
    'Target Repo': input.targetRepo,
    'Target Paths': input.targetPaths.join(', ') || 'N/A',
    'Artifacts Produced': 'runtime-only',
    'Execution Path': 'build',
    'Branch': input.branchName,
    'Mutation Summary': input.mutationSummary.join(', ') || 'none'
  }).sort(([left], [right]) => left.localeCompare(right)));

  return mutationKernel({
    currentBody: input.currentBody,
    currentLabels: ['tier-3'],
    desiredTier: 'tier-3',
    evidenceFields,
    allowedLabelMutations: ['tier-0', 'tier-1', 'tier-2', 'tier-3']
  }).newBody;
}

function parseBuildMutations(value: unknown): BuildMutation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => entry as Record<string, unknown>)
    .flatMap((entry) => {
      const filePath = typeof entry.path === 'string' ? entry.path : '';
      const content = typeof entry.content === 'string' ? entry.content : '';
      if (filePath.trim().length === 0) {
        return [];
      }
      return [{ path: filePath, content }];
    });
}

function parseBuildChecks(value: unknown): BuildCheck[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => entry as Record<string, unknown>)
    .flatMap((entry) => {
      const command = typeof entry.command === 'string' ? entry.command.trim() : '';
      if (command.length === 0) {
        return [];
      }
      const args = Array.isArray(entry.args)
        ? entry.args.filter((arg): arg is string => typeof arg === 'string')
        : [];
      return [{ command, ...(args.length > 0 ? { args } : {}) }];
    });
}

export function executeBuildMission(input: BuildMissionExecutionInput, options: { commandRunner?: CommandRunner } = {}): BuildMissionExecutionResult {
  const runner = options.commandRunner ?? defaultCommandRunner;
  const allowedPaths = sortedUnique(input.targetPaths.map((entry) => normalizeRepoPath(entry)).filter((entry) => entry.length > 0));
  const branchName = buildBranchName({
    missionId: input.missionId,
    runId: input.runId,
    targetRepo: input.targetRepo,
    targetPaths: allowedPaths
  });

  if (branchExists(runner, branchName)) {
    throw new Error('BUILD_TARGET_SCOPE_DENIED');
  }

  const normalizedMutations = ensureMutationsAllowed({
    mutations: input.mutationPlan,
    targetPaths: allowedPaths
  });

  runOrFail(runner, 'git', ['checkout', '-b', branchName], 'BUILD_TARGET_SCOPE_DENIED');

  for (const mutation of normalizedMutations) {
    fs.mkdirSync(path.dirname(mutation.path), { recursive: true });
    fs.writeFileSync(mutation.path, mutation.content, 'utf8');
  }

  const targetFiles = normalizedMutations.map((entry) => entry.path);
  runOrFail(runner, 'git', ['add', '--', ...targetFiles], 'BUILD_TARGET_SCOPE_DENIED');

  const staged = runOrFail(runner, 'git', ['diff', '--cached', '--name-only'], 'BUILD_TARGET_SCOPE_DENIED')
    .stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort((left, right) => left.localeCompare(right));

  ensureNoForbiddenStagedFiles(staged);
  ensureOnlyExpectedStagedFiles(staged, targetFiles);

  runChecks(runner, input.checks);

  runOrFail(
    runner,
    'git',
    ['commit', '-m', `${DEFAULT_COMMIT_MESSAGE_PREFIX}${input.missionId}`],
    'BUILD_TARGET_SCOPE_DENIED'
  );
  runOrFail(runner, 'git', ['push', '--set-upstream', 'origin', branchName], 'BUILD_TARGET_SCOPE_DENIED');

  const viewResult = runner('gh', ['pr', 'view', '--head', branchName, '--json', 'number,url,body']);
  const existing = viewResult.code === 0 ? parsePrView(viewResult.stdout) : {};

  const mutationSummary = normalizedMutations.map((entry) => entry.path);
  const prBody = buildProvenanceBody({
    currentBody: existing.body ?? '',
    missionId: input.missionId,
    runId: input.runId,
    targetRepo: input.targetRepo,
    targetPaths: allowedPaths,
    branchName,
    mutationSummary
  });
  const prBodyFile = writePrBodyFile(input.runId, prBody);

  let prNumber = existing.number;
  let prUrl = existing.url;

  if (typeof existing.number === 'number') {
    runOrFail(runner, 'gh', ['pr', 'edit', String(existing.number), '--body-file', prBodyFile], 'BUILD_TARGET_SCOPE_DENIED');
    runOrFail(runner, 'gh', ['pr', 'edit', String(existing.number), '--add-label', 'tier-3'], 'BUILD_TARGET_SCOPE_DENIED');
  } else {
    const createResult = runOrFail(runner, 'gh', [
      'pr',
      'create',
      '--base',
      DEFAULT_BASE_BRANCH,
      '--head',
      branchName,
      '--title',
      `${DEFAULT_COMMIT_MESSAGE_PREFIX}${input.missionId}`,
      '--body-file',
      prBodyFile
    ], 'BUILD_TARGET_SCOPE_DENIED');

    prNumber = parsePrNumber(createResult.stdout);
    prUrl = createResult.stdout
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.includes('/pull/'));

    if (prNumber === undefined || prUrl === undefined) {
      const reloaded = runOrFail(runner, 'gh', ['pr', 'view', '--head', branchName, '--json', 'number,url'], 'BUILD_TARGET_SCOPE_DENIED');
      const parsed = parsePrView(reloaded.stdout);
      prNumber = parsed.number;
      prUrl = parsed.url;
    }

    if (prNumber !== undefined) {
      runOrFail(runner, 'gh', ['pr', 'edit', String(prNumber), '--add-label', 'tier-3'], 'BUILD_TARGET_SCOPE_DENIED');
    }
  }

  return {
    branchName,
    ...(prNumber !== undefined ? { prNumber } : {}),
    ...(prUrl ? { prUrl } : {}),
    mutationSummary
  };
}

export function parseBuildMissionContext(value: Record<string, unknown>): {
  mutationPlan: BuildMutation[];
  checks: BuildCheck[];
} {
  return {
    mutationPlan: parseBuildMutations(value.buildMutations),
    checks: parseBuildChecks(value.buildChecks)
  };
}

export const __testOnly = {
  buildBranchName,
  ensureNoForbiddenStagedFiles,
  ensureOnlyExpectedStagedFiles,
  parseBuildMissionContext
};
