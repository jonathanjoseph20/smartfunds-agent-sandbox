import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { executeBuildMission, __testOnly, parseBuildMissionContext } from './build-mission-executor.ts';

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

function withCwd<T>(cwd: string, fn: () => T): T {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

describe('build-mission-executor', () => {
  it('T-SPC-BE1 produces deterministic branch names', () => {
    const first = __testOnly.buildBranchName({
      missionId: 'dashboard-copy-refresh',
      runId: 'run_0001',
      targetRepo: 'smartfunds-agent-sandbox',
      targetPaths: ['dashboard/**', 'docs/**']
    });
    const second = __testOnly.buildBranchName({
      missionId: 'dashboard-copy-refresh',
      runId: 'run_0001',
      targetRepo: 'smartfunds-agent-sandbox',
      targetPaths: ['docs/**', 'dashboard/**']
    });

    expect(second).toBe(first);
  });

  it('T-SPC-BE2 parses mission context deterministically', () => {
    const parsed = parseBuildMissionContext({
      buildMutations: [
        { path: 'docs/a.md', content: 'A\n' },
        { path: 'dashboard/ui/index.html', content: '<h1>x</h1>\n' }
      ],
      buildChecks: [
        { command: 'npm', args: ['run', 'lint'] },
        { command: 'npm', args: ['test'] }
      ]
    });

    expect(parsed).toEqual({
      mutationPlan: [
        { path: 'docs/a.md', content: 'A\n' },
        { path: 'dashboard/ui/index.html', content: '<h1>x</h1>\n' }
      ],
      checks: [
        { command: 'npm', args: ['run', 'lint'] },
        { command: 'npm', args: ['test'] }
      ]
    });
  });

  it('T-SPC-BE3 runs deterministic branch/commit/pr flow with provenance', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'build-mission-executor-'));
    const state = {
      stagedFiles: [] as string[],
      createdPrBody: ''
    };

    const runner = (command: string, args: string[]): CommandResult => {
      if (command === 'git') {
        if (args[0] === 'show-ref' || args[0] === 'ls-remote') {
          return { code: 1, stdout: '', stderr: '' };
        }
        if (args[0] === 'add') {
          state.stagedFiles = args.slice(2).map((entry) => entry.trim()).sort((left, right) => left.localeCompare(right));
          return { code: 0, stdout: '', stderr: '' };
        }
        if (args[0] === 'diff' && args[1] === '--cached' && args[2] === '--name-only') {
          return { code: 0, stdout: `${state.stagedFiles.join('\n')}\n`, stderr: '' };
        }
        return { code: 0, stdout: '', stderr: '' };
      }

      if (command === 'gh') {
        if (args[0] === 'pr' && args[1] === 'view') {
          return { code: 1, stdout: '', stderr: '' };
        }
        if (args[0] === 'pr' && args[1] === 'create') {
          const bodyFile = args[args.indexOf('--body-file') + 1];
          state.createdPrBody = fs.readFileSync(bodyFile as string, 'utf8');
          return { code: 0, stdout: 'https://example.test/org/repo/pull/24\n', stderr: '' };
        }
        if (args[0] === 'pr' && args[1] === 'edit') {
          return { code: 0, stdout: '', stderr: '' };
        }
      }

      return { code: 1, stdout: '', stderr: 'unsupported' };
    };

    const result = withCwd(tmpRoot, () => executeBuildMission({
      missionId: 'dashboard-copy-refresh',
      runId: 'run_smartfunds-core_0001',
      targetRepo: 'smartfunds-agent-sandbox',
      targetPaths: ['dashboard/**', 'docs/**'],
      mutationPlan: [
        { path: 'docs/build-mission.md', content: '# Build Mission\n' },
        { path: 'dashboard/ui/index.html', content: '<h1>Build</h1>\n' }
      ],
      checks: []
    }, { commandRunner: runner }));

    expect(result.branchName).toContain('build/dashboard-copy-refresh/');
    expect(result.prNumber).toBe(24);
    expect(result.prUrl).toBe('https://example.test/org/repo/pull/24');
    expect(result.mutationSummary).toEqual(['dashboard/ui/index.html', 'docs/build-mission.md']);
    expect(state.createdPrBody).toContain('Mission ID: dashboard-copy-refresh');
    expect(state.createdPrBody).toContain('Execution Path: build');
    expect(state.createdPrBody).toContain('missionId: dashboard-copy-refresh');
    expect(state.createdPrBody).toContain('runId: run_smartfunds-core_0001');
    expect(state.createdPrBody).toContain('profile: build');
    expect(state.createdPrBody).toContain('scope: smartfunds-agent-sandbox:dashboard/**, docs/**');
    expect(state.createdPrBody).toContain('classification: requestedProfile=build;requiredProfile=build;finalProfile=build;source=metadata');
  });

  it('T-SPC-BE4 rejects runtime artifact leakage into staged files', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'build-mission-executor-'));
    const runner = (command: string, args: string[]): CommandResult => {
      if (command === 'git') {
        if (args[0] === 'show-ref' || args[0] === 'ls-remote') {
          return { code: 1, stdout: '', stderr: '' };
        }
        if (args[0] === 'diff') {
          return {
            code: 0,
            stdout: 'docs/build-mission.md\nartifacts/build/run_1/report.md\n',
            stderr: ''
          };
        }
        return { code: 0, stdout: '', stderr: '' };
      }
      return { code: 1, stdout: '', stderr: '' };
    };

    expect(() => withCwd(tmpRoot, () => executeBuildMission({
      missionId: 'dashboard-copy-refresh',
      runId: 'run_smartfunds-core_0001',
      targetRepo: 'smartfunds-agent-sandbox',
      targetPaths: ['docs/**'],
      mutationPlan: [{ path: 'docs/build-mission.md', content: '# Build\n' }],
      checks: []
    }, { commandRunner: runner }))).toThrowError('BUILD_PROTECTED_SCOPE_FORBIDDEN');
  });
});
