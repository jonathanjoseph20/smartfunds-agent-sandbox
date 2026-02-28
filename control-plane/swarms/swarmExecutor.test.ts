import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { runSwarmExecution, type SwarmExecutionResult } from './swarmExecutor.ts';

const TEST_ADAPTER_KEY = '__SMARTFUNDS_SWARM_EXECUTION_ADAPTER__';

type TestAdapter = {
  branchExistsLocal: (branchName: string) => boolean;
  branchExistsRemote: (branchName: string) => boolean;
  checkoutNewBranch: (branchName: string) => void;
  stageFile: (filePath: string) => void;
  commit: (message: string) => void;
  pushBranch: (branchName: string) => void;
  createPullRequest: (params: { base: string; head: string; title: string; body: string; labels: string[] }) => { prCreated: boolean };
  capture: {
    prBody: string | null;
    prLabels: string[];
  };
};

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createFixtureRoot(params: { teamMode: 'structured' | 'autonomous'; swarmMode: 'structured' | 'autonomous' }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-executor-'));

  writeJson(path.join(root, 'control-plane/projects/docs.json'), {
    projectId: 'docs',
    ownedPaths: ['control-plane/swarms/runtime-artifacts/docs/**']
  });

  writeJson(path.join(root, 'control-plane/teams/docs-team.json'), {
    teamId: 'docs-team',
    projectId: 'docs',
    executionMode: params.teamMode,
    ownedPaths: ['control-plane/swarms/runtime-artifacts/docs/**']
  });

  writeJson(path.join(root, 'control-plane/swarms/marketing-team.json'), {
    swarmId: 'marketing-team',
    project: 'docs',
    team: 'docs-team',
    executionMode: params.swarmMode
  });

  writeJson(path.join(root, 'control-plane/entities/registry.json'), [
    {
      entityId: 'docs-entity',
      legalName: 'Docs Entity',
      projects: ['docs'],
      complianceProfile: 'phase-1',
      custodyMode: 'non_custodial'
    }
  ]);

  writeJson(path.join(root, 'control-plane/entities/rails.json'), {
    version: 1,
    entities: [
      {
        entityId: 'docs-entity',
        railProfile: 'hybrid'
      }
    ]
  });

  return root;
}

function createAdapter(): TestAdapter {
  const localBranches = new Set<string>();
  const remoteBranches = new Set<string>();
  const capture = {
    prBody: null as string | null,
    prLabels: [] as string[]
  };

  return {
    branchExistsLocal: (branchName) => localBranches.has(branchName),
    branchExistsRemote: (branchName) => remoteBranches.has(branchName),
    checkoutNewBranch: (branchName) => {
      localBranches.add(branchName);
    },
    stageFile: () => {
      // no-op
    },
    commit: () => {
      // no-op
    },
    pushBranch: (branchName) => {
      remoteBranches.add(branchName);
    },
    createPullRequest: (params) => {
      capture.prBody = params.body;
      capture.prLabels = [...params.labels].sort((a, b) => a.localeCompare(b));
      return { prCreated: true };
    },
    capture
  };
}

function withFixture<T>(
  params: { teamMode: 'structured' | 'autonomous'; swarmMode: 'structured' | 'autonomous' },
  run: (ctx: { root: string; adapter: TestAdapter }) => Promise<T>
): Promise<T> {
  const root = createFixtureRoot(params);
  const adapter = createAdapter();
  const previous = process.cwd();

  process.chdir(root);
  (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY] = adapter;

  return run({ root, adapter }).finally(() => {
    delete (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY];
    process.chdir(previous);
  });
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[TEST_ADAPTER_KEY];
});

describe('swarmExecutor', () => {
  it('resolves swarm and executes deterministic bounded flow', async () => {
    await withFixture({ teamMode: 'autonomous', swarmMode: 'autonomous' }, async ({ root }) => {
      const result = await runSwarmExecution({
        swarmId: 'marketing-team',
        projectId: 'docs',
        executionMode: 'autonomous',
        taskIntent: 'update docs marker'
      });

      expect(result.prCreated).toBe(true);
      expect(result.branchName).toBe('swarm/marketing-team/run-1');
      expect(result.tasksExecuted).toBe(1);
      expect(result.retryEligible).toBe(true);

      const artifactPath = path.join(root, 'control-plane/swarms/runtime-artifacts/docs/marketing-team/run-1.txt');
      expect(fs.readFileSync(artifactPath, 'utf8')).toBe(
        'executionMode: autonomous\nprojectId: docs\nswarmId: marketing-team\ntaskIntent: update docs marker\n'
      );
    });
  });

  it('fails deterministically when swarm is missing', async () => {
    await withFixture({ teamMode: 'autonomous', swarmMode: 'autonomous' }, async () => {
      await expect(() =>
        runSwarmExecution({
          swarmId: 'missing',
          projectId: 'docs',
          executionMode: 'autonomous',
          taskIntent: 'update docs marker'
        })
      ).rejects.toThrow('SWARM_NOT_FOUND: missing');
    });
  });

  it('rejects deterministic mode mismatch when autonomous requested against structured-only project', async () => {
    await withFixture({ teamMode: 'structured', swarmMode: 'autonomous' }, async () => {
      await expect(() =>
        runSwarmExecution({
          swarmId: 'marketing-team',
          projectId: 'docs',
          executionMode: 'autonomous',
          taskIntent: 'update docs marker'
        })
      ).rejects.toThrow('MODE_MISMATCH: autonomous_requested_but_project_structured_only');
    });
  });

  it('generates tier-3 sealed PR body deterministically through mutation kernel', async () => {
    await withFixture({ teamMode: 'autonomous', swarmMode: 'autonomous' }, async ({ adapter }) => {
      await runSwarmExecution({
        swarmId: 'marketing-team',
        projectId: 'docs',
        executionMode: 'autonomous',
        taskIntent: 'update docs marker'
      });

      const body = adapter.capture.prBody;
      expect(body).not.toBeNull();
      expect(body?.startsWith('tier-3\n\n```evidence\n')).toBe(true);
      expect(body?.endsWith('\n```')).toBe(true);
      expect(body).toContain('execution-mode: autonomous');
      expect(body).toContain('project-id: docs');
      expect(body).toContain('swarm-id: marketing-team');
      expect(body).toContain('task-intent: update docs marker');
      expect(adapter.capture.prLabels).toEqual(['tier-3', 'tier-3-approved']);
    });
  });

  it('keeps deterministic hash stable across equivalent runs', async () => {
    const first = await withFixture({ teamMode: 'autonomous', swarmMode: 'autonomous' }, async () => {
      return runSwarmExecution({
        swarmId: 'marketing-team',
        projectId: 'docs',
        executionMode: 'autonomous',
        taskIntent: 'update docs marker'
      });
    });

    const second = await withFixture({ teamMode: 'autonomous', swarmMode: 'autonomous' }, async () => {
      return runSwarmExecution({
        swarmId: 'marketing-team',
        projectId: 'docs',
        executionMode: 'autonomous',
        taskIntent: 'update docs marker'
      });
    });

    expect(second.deterministicHash).toBe(first.deterministicHash);
  });

  it('integration simulation produces stable result payload', async () => {
    await withFixture({ teamMode: 'autonomous', swarmMode: 'autonomous' }, async () => {
      const result = await runSwarmExecution({
        swarmId: 'marketing-team',
        projectId: 'docs',
        executionMode: 'autonomous',
        taskIntent: 'update docs marker'
      });

      const json = canonicalStringify(result satisfies SwarmExecutionResult);
      expect(json).toBe(
        '{"branchName":"swarm/marketing-team/run-1","deterministicHash":"adebafc4b5ff8ff73a0c75feb650bc77df6a2ec11f0fb4351dca8b9cc2d02bba","executionMode":"autonomous","prCreated":true,"projectId":"docs","retryEligible":true,"swarmId":"marketing-team","tasksExecuted":1}'
      );
    });
  });

  it('fails closed on second execution when deterministic branch already exists', async () => {
    await withFixture({ teamMode: 'autonomous', swarmMode: 'autonomous' }, async () => {
      await runSwarmExecution({
        swarmId: 'marketing-team',
        projectId: 'docs',
        executionMode: 'autonomous',
        taskIntent: 'update docs marker'
      });

      await expect(() =>
        runSwarmExecution({
          swarmId: 'marketing-team',
          projectId: 'docs',
          executionMode: 'autonomous',
          taskIntent: 'update docs marker'
        })
      ).rejects.toThrow('BRANCH_ALREADY_EXISTS: swarm/marketing-team/run-1');
    });
  });

  it('does not depend on retry modules', () => {
    const source = fs.readFileSync('control-plane/swarms/swarmExecutor.ts', 'utf8');
    expect(source.includes('/retry/')).toBe(false);
    expect(source.includes('governance:autonomous-retry')).toBe(false);
    expect(source.includes('runRetry')).toBe(false);
  });
});
