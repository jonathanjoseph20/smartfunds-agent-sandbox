import fs from 'node:fs';

import { stablePlanOps } from './patchPlanner.ts';
import type { PatchOp, PatchPlan } from './patchTypes.ts';

type CommandRunner = (args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;

type WriteFile = (path: string, body: string) => void;

export type ApplyPatchPlanParams = {
  prNumber: number;
  plan: PatchPlan;
  dryRun: boolean;
  gh: CommandRunner;
  git: CommandRunner;
  writeFile?: WriteFile;
};

export type ApplyPatchPlanResult = {
  appliedOps: PatchOp[];
  commands: string[];
  outcome: 'applied' | 'noop' | 'failed';
  failureReason?: string;
};

const TEMP_PR_BODY_PATH = './.tmp/pr-body.md';
const REFRESH_COMMIT_MESSAGE = 'chore(governance): refresh payload';

function defaultWriteFile(path: string, body: string): void {
  fs.mkdirSync('./.tmp', { recursive: true });
  fs.writeFileSync(path, `${body}\n`, 'utf8');
}

function commandForOp(prNumber: number, op: PatchOp): string[] {
  if (op.op === 'add_label') {
    return [`gh pr edit ${prNumber} --add-label "${op.label}"`];
  }
  if (op.op === 'set_pr_body') {
    return [
      `write-file ${TEMP_PR_BODY_PATH}`,
      `gh pr edit ${prNumber} --body-file ${TEMP_PR_BODY_PATH}`
    ];
  }
  if (op.op === 'refresh_payload') {
    return [
      `git commit --allow-empty -m "${REFRESH_COMMIT_MESSAGE}"`,
      'git push'
    ];
  }
  return [];
}

function buildCommandList(prNumber: number, ops: PatchOp[]): string[] {
  const commands: string[] = [];
  for (const op of stablePlanOps(ops)) {
    commands.push(...commandForOp(prNumber, op));
  }
  return commands;
}

export async function applyPatchPlan(params: ApplyPatchPlanParams): Promise<ApplyPatchPlanResult> {
  const orderedOps = stablePlanOps(params.plan.ops);
  const commands = buildCommandList(params.prNumber, orderedOps);

  if (orderedOps.length === 0 || orderedOps.every((entry) => entry.op === 'noop')) {
    return {
      appliedOps: [],
      commands,
      outcome: 'noop'
    };
  }

  if (params.dryRun) {
    return {
      appliedOps: [],
      commands,
      outcome: 'noop'
    };
  }

  const writeFile = params.writeFile ?? defaultWriteFile;
  const appliedOps: PatchOp[] = [];

  for (const op of orderedOps) {
    if (op.op === 'noop') {
      continue;
    }

    if (op.op === 'add_label') {
      const result = await params.gh(['pr', 'edit', String(params.prNumber), '--add-label', op.label]);
      if (result.code !== 0) {
        return {
          appliedOps,
          commands,
          outcome: 'failed',
          failureReason: 'gh_failed:add_label'
        };
      }
      appliedOps.push(op);
      continue;
    }

    if (op.op === 'set_pr_body') {
      try {
        writeFile(TEMP_PR_BODY_PATH, op.body);
      } catch {
        return {
          appliedOps,
          commands,
          outcome: 'failed',
          failureReason: 'write_failed:set_pr_body'
        };
      }

      const result = await params.gh(['pr', 'edit', String(params.prNumber), '--body-file', TEMP_PR_BODY_PATH]);
      if (result.code !== 0) {
        return {
          appliedOps,
          commands,
          outcome: 'failed',
          failureReason: 'gh_failed:set_pr_body'
        };
      }
      appliedOps.push(op);
      continue;
    }

    if (op.op === 'refresh_payload') {
      const commit = await params.git(['commit', '--allow-empty', '-m', REFRESH_COMMIT_MESSAGE]);
      if (commit.code !== 0) {
        return {
          appliedOps,
          commands,
          outcome: 'failed',
          failureReason: 'git_failed:commit'
        };
      }

      const push = await params.git(['push']);
      if (push.code !== 0) {
        return {
          appliedOps,
          commands,
          outcome: 'failed',
          failureReason: 'git_failed:push'
        };
      }
      appliedOps.push(op);
    }
  }

  return {
    appliedOps,
    commands,
    outcome: 'applied'
  };
}
