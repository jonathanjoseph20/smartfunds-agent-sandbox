import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { __testOnly, runSwarmExecutor, type SwarmExecutorOptions } from './swarm-executor.ts';
import type { SwarmExecutionArgs } from './types.ts';

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = NonNullable<SwarmExecutorOptions['commandRunner']>;

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function setupFixture(params: {
  projectOwnedPaths: string[];
  teamExecutionMode: 'structured' | 'autonomous';
  swarmExecutionMode: 'structured' | 'autonomous';
}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-runner-'));

  writeJson(path.join(root, 'control-plane/projects/core-app.json'), {
    projectId: 'core-app',
    ownedPaths: params.projectOwnedPaths
  });

  writeJson(path.join(root, 'control-plane/teams/core-engineering.json'), {
    teamId: 'core-engineering',
    projectId: 'core-app',
    executionMode: params.teamExecutionMode,
    ownedPaths: params.projectOwnedPaths
  });

  writeJson(path.join(root, 'control-plane/swarms/dev-team.json'), {
    swarmId: 'dev-team',
    project: 'core-app',
    team: 'core-engineering',
    executionMode: params.swarmExecutionMode
  });

  return root;
}

function withCwd<T>(cwd: string, fn: () => T): T {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

function createFakeRunner(): CommandRunner {
  const state = {
    branchExists: false,
    prNumber: 7,
    prUrl: 'https://example.test/repo/pull/7',
    body: ''
  };

  return (command: string, args: string[]): CommandResult => {
    if (command === 'git') {
      if (args[0] === 'show-ref') {
        return { code: state.branchExists ? 0 : 1, stdout: '', stderr: '' };
      }
      if (args[0] === 'ls-remote') {
        return { code: 1, stdout: '', stderr: '' };
      }
      if (args[0] === 'checkout' && args[1] === '-b') {
        state.branchExists = true;
        return { code: 0, stdout: '', stderr: '' };
      }
      return { code: 0, stdout: '', stderr: '' };
    }

    if (command === 'gh') {
      if (args[0] === 'pr' && args[1] === 'view') {
        return { code: 1, stdout: '', stderr: '' };
      }
      if (args[0] === 'pr' && args[1] === 'create') {
        return { code: 0, stdout: `${state.prUrl}\n`, stderr: '' };
      }
      if (args[0] === 'pr' && args[1] === 'edit') {
        return { code: 0, stdout: '', stderr: '' };
      }
    }

    return { code: 1, stdout: '', stderr: 'unsupported command' };
  };
}

function runGit(cwd: string, args: string[]): CommandResult {
  try {
    const stdout = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, stdout: stdout ?? '', stderr: '' };
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

function createIntegrationRunner(cwd: string): CommandRunner {
  let prExists = false;
  const prState = {
    number: 12,
    url: 'https://example.test/repo/pull/12',
    body: ''
  };

  return (command: string, args: string[]): CommandResult => {
    if (command === 'git') {
      return runGit(cwd, args);
    }

    if (command !== 'gh') {
      return { code: 1, stdout: '', stderr: 'unsupported command' };
    }

    if (args[0] === 'pr' && args[1] === 'view') {
      if (!prExists) {
        return { code: 1, stdout: '', stderr: 'not found' };
      }

      const wantsBody = args.includes('number,url,body');
      const payload = wantsBody
        ? { number: prState.number, url: prState.url, body: prState.body }
        : { number: prState.number, url: prState.url };

      return {
        code: 0,
        stdout: `${JSON.stringify(payload)}\n`,
        stderr: ''
      };
    }

    if (args[0] === 'pr' && args[1] === 'create') {
      prExists = true;
      return {
        code: 0,
        stdout: `${prState.url}\n`,
        stderr: ''
      };
    }

    if (args[0] === 'pr' && args[1] === 'edit') {
      const bodyIndex = args.indexOf('--body-file');
      if (bodyIndex >= 0) {
        const filePath = args[bodyIndex + 1];
        prState.body = fs.readFileSync(path.join(cwd, filePath), 'utf8');
      }
      return { code: 0, stdout: '', stderr: '' };
    }

    return { code: 1, stdout: '', stderr: 'unsupported gh command' };
  };
}

function baseArgs(overrides: Partial<SwarmExecutionArgs> = {}): SwarmExecutionArgs {
  return {
    projectId: 'core-app',
    swarmId: 'dev-team',
    executionMode: 'structured',
    intent: 'Add readme header',
    ...overrides
  };
}

describe('swarm-executor', () => {
  it('runId determinism', () => {
    const first = __testOnly.buildRunId(baseArgs(), 1);
    const second = __testOnly.buildRunId(baseArgs(), 1);

    expect(second).toBe(first);
  });

  it('branchName determinism', () => {
    expect(__testOnly.buildBranchName(baseArgs(), 1)).toBe('swarm/core-app/dev-team/run-1');
  });

  it('mode mismatch failure', () => {
    const root = setupFixture({
      projectOwnedPaths: ['control-plane/**'],
      teamExecutionMode: 'structured',
      swarmExecutionMode: 'autonomous'
    });

    const result = withCwd(root, () => runSwarmExecutor(baseArgs({ executionMode: 'structured' }), {
      commandRunner: createFakeRunner()
    }));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('ERR_MODE_MISMATCH');
  });

  it('ownership violation failure', () => {
    const root = setupFixture({
      projectOwnedPaths: ['docs/**'],
      teamExecutionMode: 'structured',
      swarmExecutionMode: 'structured'
    });

    const result = withCwd(root, () => runSwarmExecutor(baseArgs(), {
      commandRunner: createFakeRunner()
    }));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('ERR_OWNERSHIP_VIOLATION');
  });

  it('evidence block structure is deterministic', () => {
    const body = __testOnly.buildCanonicalPrBody({
      swarmId: 'dev-team',
      projectId: 'core-app',
      runId: 'run-id',
      mode: 'structured',
      intentHash: 'intent-hash',
      currentBody: ''
    });

    expect(body.startsWith('tier-3\n\n```evidence\n')).toBe(true);
    expect(body.includes('\nintent-hash: intent-hash\n')).toBe(true);
    expect(body.includes('\nmode: structured\n')).toBe(true);
    expect(body.includes('\nproject-id: core-app\n')).toBe(true);
    expect(body.includes('\nrun-id: run-id\n')).toBe(true);
    expect(body.includes('\nswarm-id: dev-team\n')).toBe(true);
    const keyOrder = ['intent-hash:', 'mode:', 'project-id:', 'run-id:', 'swarm-id:']
      .map((key) => body.indexOf(`\n${key} `));
    expect(keyOrder.every((value) => value >= 0)).toBe(true);
    expect(keyOrder).toEqual([...keyOrder].sort((left, right) => left - right));
    expect(body.endsWith('\n```')).toBe(true);
  });

  it('stable sorting of mutatedFiles', () => {
    const values = ['z.txt', 'a.txt', 'm.txt'];
    expect(__testOnly.sortStrings(values)).toEqual(['a.txt', 'm.txt', 'z.txt']);
  });

  it('idempotent hash behavior', () => {
    const fixture = {
      runId: 'a',
      projectId: 'core-app',
      swarmId: 'dev-team',
      executionMode: 'structured',
      runIndex: 1,
      branchName: 'swarm/core-app/dev-team/run-1',
      mutatedFiles: ['control-plane/swarms/dev-team/run-1.txt'],
      prNumber: 12,
      resultCode: 'OK'
    };

    const first = canonicalStringify(fixture);
    const second = canonicalStringify(fixture);

    expect(second).toBe(first);
  });

  it('integration fixture creates branch, file, commit and deterministic runId', () => {
    const root = setupFixture({
      projectOwnedPaths: ['control-plane/**'],
      teamExecutionMode: 'structured',
      swarmExecutionMode: 'structured'
    });

    runGit(root, ['init']);
    runGit(root, ['config', 'user.email', 'dev@example.test']);
    runGit(root, ['config', 'user.name', 'Dev User']);
    fs.writeFileSync(path.join(root, 'README.md'), 'seed\n', 'utf8');
    runGit(root, ['add', '.']);
    runGit(root, ['commit', '-m', 'seed']);

    const bareRemote = path.join(root, 'remote.git');
    runGit(root, ['init', '--bare', bareRemote]);
    runGit(root, ['remote', 'add', 'origin', bareRemote]);
    runGit(root, ['push', '--set-upstream', 'origin', 'master']);

    const result = withCwd(root, () => runSwarmExecutor(baseArgs(), {
      commandRunner: createIntegrationRunner(root)
    }));

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(result.branchName).toBe('swarm/core-app/dev-team/run-1');
    expect(result.runId).toBe(__testOnly.buildRunId(baseArgs(), 1));

    const filePath = path.join(root, 'control-plane/swarms/dev-team/run-1.txt');
    expect(fs.existsSync(filePath)).toBe(true);
    const expectedIntentHash = sha256('Add readme header');
    expect(fs.readFileSync(filePath, 'utf8')).toBe(
      `Swarm Run Report\nProject: core-app\nSwarm: dev-team\nMode: structured\nIntent Hash: ${expectedIntentHash}\nRun Index: 1\n`
    );

    const commitMessage = runGit(root, ['log', '-1', '--pretty=%s']);
    expect(commitMessage.stdout.trim()).toBe('feat: swarm execution run');

    const branchCheck = runGit(root, ['rev-parse', '--verify', 'swarm/core-app/dev-team/run-1']);
    expect(branchCheck.code).toBe(0);
  });

  it('second invocation returns ERR_GIT_BRANCH_EXISTS', () => {
    const root = setupFixture({
      projectOwnedPaths: ['control-plane/**'],
      teamExecutionMode: 'structured',
      swarmExecutionMode: 'structured'
    });

    runGit(root, ['init']);
    runGit(root, ['config', 'user.email', 'dev@example.test']);
    runGit(root, ['config', 'user.name', 'Dev User']);
    fs.writeFileSync(path.join(root, 'README.md'), 'seed\n', 'utf8');
    runGit(root, ['add', '.']);
    runGit(root, ['commit', '-m', 'seed']);

    const bareRemote = path.join(root, 'remote.git');
    runGit(root, ['init', '--bare', bareRemote]);
    runGit(root, ['remote', 'add', 'origin', bareRemote]);
    runGit(root, ['push', '--set-upstream', 'origin', 'master']);

    withCwd(root, () => runSwarmExecutor(baseArgs(), {
      commandRunner: createIntegrationRunner(root)
    }));

    const second = withCwd(root, () => runSwarmExecutor(baseArgs(), {
      commandRunner: createIntegrationRunner(root)
    }));

    expect(second.ok).toBe(false);
    expect(second.code).toBe('ERR_GIT_BRANCH_EXISTS');
  });
});
