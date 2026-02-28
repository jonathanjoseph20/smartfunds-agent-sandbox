import { describe, expect, it } from 'vitest';

import { applyPatchPlan } from '../patchApplier.ts';
import type { PatchPlan } from '../patchTypes.ts';

type RunnerCall = { runner: 'gh' | 'git'; args: string[] };

function successRunner(callLog: RunnerCall[], runner: 'gh' | 'git') {
  return async (args: string[]) => {
    callLog.push({ runner, args: [...args] });
    return { code: 0, stdout: '', stderr: '' };
  };
}

describe('patchApplier', () => {
  it('applies commands in canonical order', async () => {
    const callLog: RunnerCall[] = [];
    const writes: Array<{ path: string; body: string }> = [];

    const plan: PatchPlan = {
      version: 'v1',
      governanceErrorCode: 'MISSING_EVIDENCE_BLOCK',
      retryAttempt: 0,
      ops: [
        { op: 'add_label', label: 'tier-3' },
        { op: 'add_label', label: 'a-label' },
        { op: 'set_pr_body', body: 'tier-3\n\n```evidence\nRisk Tier: 3\n```' },
        { op: 'refresh_payload', method: 'empty_commit' }
      ]
    };

    const result = await applyPatchPlan({
      prNumber: 41,
      plan,
      dryRun: false,
      gh: successRunner(callLog, 'gh'),
      git: successRunner(callLog, 'git'),
      writeFile: (path, body) => {
        writes.push({ path, body });
      }
    });

    expect(result.outcome).toBe('applied');
    expect(result.commands).toEqual([
      'gh pr edit 41 --add-label "a-label"',
      'gh pr edit 41 --add-label "tier-3"',
      'write-file ./.tmp/pr-body.md',
      'gh pr edit 41 --body-file ./.tmp/pr-body.md',
      'git commit --allow-empty -m "chore(governance): refresh payload"',
      'git push'
    ]);

    expect(callLog).toEqual([
      { runner: 'gh', args: ['pr', 'edit', '41', '--add-label', 'a-label'] },
      { runner: 'gh', args: ['pr', 'edit', '41', '--add-label', 'tier-3'] },
      { runner: 'gh', args: ['pr', 'edit', '41', '--body-file', './.tmp/pr-body.md'] },
      { runner: 'git', args: ['commit', '--allow-empty', '-m', 'chore(governance): refresh payload'] },
      { runner: 'git', args: ['push'] }
    ]);

    expect(writes).toEqual([
      { path: './.tmp/pr-body.md', body: 'tier-3\n\n```evidence\nRisk Tier: 3\n```' }
    ]);
  });

  it('dry-run returns deterministic commands and applies nothing', async () => {
    const callLog: RunnerCall[] = [];
    const writes: string[] = [];

    const plan: PatchPlan = {
      version: 'v1',
      governanceErrorCode: 'MISSING_TIER_LABEL',
      retryAttempt: 0,
      ops: [
        { op: 'add_label', label: 'tier-2' },
        { op: 'refresh_payload', method: 'empty_commit' }
      ]
    };

    const result = await applyPatchPlan({
      prNumber: 41,
      plan,
      dryRun: true,
      gh: successRunner(callLog, 'gh'),
      git: successRunner(callLog, 'git'),
      writeFile: () => {
        writes.push('write');
      }
    });

    expect(result.outcome).toBe('noop');
    expect(result.appliedOps).toEqual([]);
    expect(result.commands).toEqual([
      'gh pr edit 41 --add-label "tier-2"',
      'git commit --allow-empty -m "chore(governance): refresh payload"',
      'git push'
    ]);
    expect(callLog).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('stops on failure and returns partial applied ops', async () => {
    const callLog: RunnerCall[] = [];

    const plan: PatchPlan = {
      version: 'v1',
      governanceErrorCode: 'MISSING_TIER_LABEL',
      retryAttempt: 0,
      ops: [
        { op: 'add_label', label: 'a-label' },
        { op: 'add_label', label: 'z-label' },
        { op: 'refresh_payload', method: 'empty_commit' }
      ]
    };

    let ghCalls = 0;
    const gh = async (args: string[]) => {
      callLog.push({ runner: 'gh', args: [...args] });
      ghCalls += 1;
      if (ghCalls === 2) {
        return { code: 1, stdout: '', stderr: 'boom' };
      }
      return { code: 0, stdout: '', stderr: '' };
    };

    const git = successRunner(callLog, 'git');

    const result = await applyPatchPlan({
      prNumber: 41,
      plan,
      dryRun: false,
      gh,
      git
    });

    expect(result.outcome).toBe('failed');
    expect(result.failureReason).toBe('gh_failed:add_label');
    expect(result.appliedOps).toEqual([
      { op: 'add_label', label: 'a-label' }
    ]);
    expect(callLog).toEqual([
      { runner: 'gh', args: ['pr', 'edit', '41', '--add-label', 'a-label'] },
      { runner: 'gh', args: ['pr', 'edit', '41', '--add-label', 'z-label'] }
    ]);
  });
});
