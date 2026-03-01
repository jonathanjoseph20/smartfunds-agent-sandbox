import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { mutationKernel } from '../pr/mutationKernel.ts';
import { loadProjectsFromDir, loadTeamsFromDir } from '../studio/registry.ts';
import { resolveOwnership } from '../studio/ownership.ts';
import { loadSwarmsFromDir } from '../swarms/registry.ts';
import type { RunState } from '../execution/runState.ts';
import type { SwarmExecutionArgs, SwarmExecutionResult } from './types.ts';

type ExecutionMode = 'structured' | 'autonomous';

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type CommandRunner = (command: string, args: string[]) => CommandResult;

const DEFAULT_PROJECTS_DIR = 'control-plane/projects';
const DEFAULT_TEAMS_DIR = 'control-plane/teams';
const DEFAULT_SWARMS_DIR = 'control-plane/swarms';
const DEFAULT_BASE_BRANCH = 'main';
const DEFAULT_COMMIT_MESSAGE = 'feat: swarm execution run';

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

function parseRunIndex(value: number | undefined): number {
  if (value === undefined) {
    return 1;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('ERR_INVALID_ARGUMENT');
  }
  return value;
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function normalizeLines(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function inferProjectModeHint(projectId: string, teamRegistry: Array<{ projectId: string; executionMode?: unknown }>): 'structured-only' | 'autonomous-only' | 'mixed' | 'unknown' {
  const modes = new Set<ExecutionMode>();

  for (const team of teamRegistry) {
    if (team.projectId !== projectId) {
      continue;
    }
    if (team.executionMode === 'structured' || team.executionMode === 'autonomous') {
      modes.add(team.executionMode);
    }
  }

  if (modes.size === 0) {
    return 'unknown';
  }
  if (modes.size > 1) {
    return 'mixed';
  }
  if (modes.has('structured')) {
    return 'structured-only';
  }
  return 'autonomous-only';
}

function buildRunId(args: SwarmExecutionArgs, runIndex: number): string {
  return sha256(canonicalStringify({
    projectId: args.projectId,
    swarmId: args.swarmId,
    executionMode: args.executionMode,
    intent: args.intent,
    runIndex
  }));
}

function buildBranchName(args: SwarmExecutionArgs, runIndex: number): string {
  return `swarm/${args.projectId}/${args.swarmId}/run-${runIndex}`;
}

function buildPatchId(args: SwarmExecutionArgs, runIndex: number): string {
  return sha256(canonicalStringify({
    projectId: args.projectId,
    swarmId: args.swarmId,
    executionMode: args.executionMode,
    intent: args.intent,
    runIndex
  }));
}

function buildTargetFile(args: SwarmExecutionArgs, runIndex: number): string {
  return path.posix.join('control-plane', 'swarms', args.swarmId, `run-${runIndex}.txt`);
}

function buildArtifactContent(args: SwarmExecutionArgs, runIndex: number): string {
  const lines = [
    'Swarm Run Report',
    `Project: ${args.projectId}`,
    `Swarm: ${args.swarmId}`,
    `Mode: ${args.executionMode}`,
    `Intent Hash: ${sha256(args.intent)}`,
    `Run Index: ${runIndex}`
  ];

  return `${normalizeLines(lines.join('\n'))}\n`;
}

function parsePrNumber(value: string): number | undefined {
  const trimmed = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of trimmed) {
    const explicit = line.match(/\/pull\/(\d+)/)?.[1];
    if (explicit) {
      const parsed = Number.parseInt(explicit, 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  const jsonCandidate = trimmed.find((line) => line.startsWith('{') && line.endsWith('}'));
  if (!jsonCandidate) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as { number?: unknown };
    if (typeof parsed.number === 'number' && Number.isInteger(parsed.number) && parsed.number > 0) {
      return parsed.number;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function parsePrView(value: string): { number?: number; url?: string; body?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as { number?: unknown; url?: unknown; body?: unknown };
    return {
      number: typeof parsed.number === 'number' && Number.isInteger(parsed.number) ? parsed.number : undefined,
      url: typeof parsed.url === 'string' ? parsed.url : undefined,
      body: typeof parsed.body === 'string' ? parsed.body : undefined
    };
  } catch {
    return {
      number: parsePrNumber(trimmed)
    };
  }
}

function buildCanonicalPrBody(args: {
  swarmId: string;
  projectId: string;
  runId: string;
  mode: ExecutionMode;
  intentHash: string;
  currentBody: string;
}): string {
  const evidenceFields: Record<string, string> = {
    'intent-hash': args.intentHash,
    'mode': args.mode,
    'project-id': args.projectId,
    'run-id': args.runId,
    'swarm-id': args.swarmId
  };

  const normalizedEvidenceFields = Object.fromEntries(
    Object.entries(evidenceFields).sort(([left], [right]) => left.localeCompare(right))
  );

  return mutationKernel({
    currentBody: args.currentBody,
    currentLabels: ['tier-3'],
    desiredTier: 'tier-3',
    evidenceFields: normalizedEvidenceFields,
    allowedLabelMutations: ['tier-0', 'tier-1', 'tier-2', 'tier-3']
  }).newBody;
}

function buildResult(args: {
  request: SwarmExecutionArgs;
  runIndex: number;
  runId: string;
  branchName: string;
  code: string;
  mutatedFiles: string[];
  appliedPatchId?: string;
  prNumber?: number;
  prUrl?: string;
}): SwarmExecutionResult {
  const sortedMutatedFiles = sortStrings(args.mutatedFiles);
  const report = {
    runId: args.runId,
    projectId: args.request.projectId,
    swarmId: args.request.swarmId,
    executionMode: args.request.executionMode,
    runIndex: args.runIndex,
    branchName: args.branchName,
    mutatedFiles: sortedMutatedFiles,
    prNumber: args.prNumber,
    resultCode: args.code
  };

  return {
    ok: args.code === 'OK',
    code: args.code,
    projectId: args.request.projectId,
    swarmId: args.request.swarmId,
    executionMode: args.request.executionMode,
    runId: args.runId,
    branchName: args.branchName,
    prNumber: args.prNumber,
    prUrl: args.prUrl,
    appliedPatchId: args.appliedPatchId,
    mutatedFiles: sortedMutatedFiles,
    reportHash: sha256(canonicalStringify(report))
  };
}

function sortStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function runOrFail(runner: CommandRunner, command: string, args: string[], codeOnFailure: string): CommandResult {
  const result = runner(command, args);
  if (result.code !== 0) {
    throw new Error(codeOnFailure);
  }
  return result;
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

function writePrBodyFile(runId: string, body: string): string {
  const dir = '.tmp';
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `swarm-run-${runId}.pr-body.md`);
  fs.writeFileSync(filePath, `${normalizeLines(body).replace(/\n*$/, '')}\n`, 'utf8');
  return filePath;
}

export type SwarmExecutorOptions = {
  commandRunner?: CommandRunner;
  hooks?: ExecutionHooks;
};

export interface ExecutionHooks {
  onState?: (state: RunState, payload?: object) => void;
}

export function runSwarmExecutor(args: SwarmExecutionArgs, options: SwarmExecutorOptions = {}): SwarmExecutionResult {
  const runner = options.commandRunner ?? defaultCommandRunner;
  const hooks = options.hooks;
  const safeRunIndex = Number.isInteger(args.runIndex) && (args.runIndex as number) > 0 ? (args.runIndex as number) : 1;
  const safeRunId = buildRunId(args, safeRunIndex);
  const safeBranchName = buildBranchName(args, safeRunIndex);
  const emitState = (state: RunState, payload?: object): void => {
    if (!hooks?.onState) {
      return;
    }

    try {
      hooks.onState(state, payload);
    } catch {
      // Hooks must not alter executor behavior.
    }
  };
  const buildFailureResult = (code: string, runIndex: number, runId: string, branchName: string): SwarmExecutionResult => {
    emitState('FAILED', { code, runId });
    return buildResult({
      request: args,
      runIndex,
      runId,
      branchName,
      code,
      mutatedFiles: []
    });
  };

  try {
    if (!isNonEmptyString(args.projectId) || !isNonEmptyString(args.swarmId) || !isNonEmptyString(args.intent)) {
      throw new Error('ERR_INVALID_ARGUMENT');
    }
    if (args.executionMode !== 'structured' && args.executionMode !== 'autonomous') {
      throw new Error('ERR_INVALID_ARGUMENT');
    }

    const runIndex = parseRunIndex(args.runIndex);
    const runId = buildRunId(args, runIndex);
    const branchName = buildBranchName(args, runIndex);

    const projects = loadProjectsFromDir(DEFAULT_PROJECTS_DIR);
    const teams = loadTeamsFromDir(DEFAULT_TEAMS_DIR, projects);
    const swarms = loadSwarmsFromDir(DEFAULT_SWARMS_DIR, projects);

    const project = projects.find((entry) => entry.projectId === args.projectId);
    if (!project) {
      return buildFailureResult('ERR_PROJECT_NOT_FOUND', runIndex, runId, branchName);
    }

    const swarm = swarms.find((entry) => entry.swarmId === args.swarmId);
    if (!swarm) {
      return buildFailureResult('ERR_SWARM_NOT_FOUND', runIndex, runId, branchName);
    }

    if (swarm.project !== args.projectId) {
      return buildFailureResult('ERR_SWARM_PROJECT_MISMATCH', runIndex, runId, branchName);
    }

    const projectMode = inferProjectModeHint(args.projectId, teams);
    if (projectMode === 'structured-only' && args.executionMode === 'autonomous') {
      return buildFailureResult('ERR_MODE_MISMATCH', runIndex, runId, branchName);
    }

    if (swarm.executionMode === 'autonomous' && args.executionMode === 'structured') {
      return buildFailureResult('ERR_MODE_MISMATCH', runIndex, runId, branchName);
    }

    const targetFile = buildTargetFile(args, runIndex);
    const ownership = resolveOwnership({
      changedFiles: [targetFile],
      projects,
      teams
    });

    if (ownership.ownershipStatus !== 'ok' || ownership.projectsTouched.length !== 1 || ownership.projectsTouched[0] !== args.projectId) {
      return buildFailureResult('ERR_OWNERSHIP_VIOLATION', runIndex, runId, branchName);
    }

    if (branchExists(runner, branchName)) {
      return buildFailureResult('ERR_GIT_BRANCH_EXISTS', runIndex, runId, branchName);
    }

    emitState('VALIDATED', { runId, branchName });
    runOrFail(runner, 'git', ['checkout', '-b', branchName], 'ERR_GIT_CHECKOUT_FAILED');
    emitState('BRANCH_CREATED', { runId, branchName });

    const content = buildArtifactContent(args, runIndex);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, content, 'utf8');
    emitState('PATCH_APPLIED', { runId, targetFile });

    runOrFail(runner, 'git', ['add', targetFile], 'ERR_GIT_ADD_FAILED');
    runOrFail(runner, 'git', ['commit', '-m', DEFAULT_COMMIT_MESSAGE], 'ERR_GIT_COMMIT_FAILED');
    emitState('COMMITTED', { runId, branchName });
    runOrFail(runner, 'git', ['push', '--set-upstream', 'origin', branchName], 'ERR_GIT_PUSH_FAILED');
    emitState('PUSHED', { runId, branchName });

    const intentHash = sha256(args.intent);
    const prView = runner('gh', ['pr', 'view', '--head', branchName, '--json', 'number,url,body']);
    const existingPr = prView.code === 0 ? parsePrView(prView.stdout) : {};
    const currentBody = existingPr.body ?? '';

    const prBody = buildCanonicalPrBody({
      swarmId: args.swarmId,
      projectId: args.projectId,
      runId,
      mode: args.executionMode,
      intentHash,
      currentBody
    });

    const prBodyFile = writePrBodyFile(runId, prBody);

    let prNumber: number | undefined = existingPr.number;
    let prUrl: string | undefined = existingPr.url;

    if (typeof existingPr.number === 'number') {
      runOrFail(runner, 'gh', ['pr', 'edit', String(existingPr.number), '--body-file', prBodyFile], 'ERR_GH_PR_UPDATE_FAILED');
      runOrFail(runner, 'gh', ['pr', 'edit', String(existingPr.number), '--add-label', 'tier-3'], 'ERR_GH_PR_UPDATE_FAILED');
    } else {
      const create = runOrFail(runner, 'gh', [
        'pr',
        'create',
        '--base',
        DEFAULT_BASE_BRANCH,
        '--head',
        branchName,
        '--title',
        DEFAULT_COMMIT_MESSAGE,
        '--body-file',
        prBodyFile
      ], 'ERR_GH_PR_CREATE_FAILED');

      prNumber = parsePrNumber(create.stdout);
      prUrl = create.stdout
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.includes('/pull/'));

      if (prNumber === undefined || prUrl === undefined) {
        const viewed = runOrFail(runner, 'gh', ['pr', 'view', '--head', branchName, '--json', 'number,url'], 'ERR_GH_PR_CREATE_FAILED');
        const parsed = parsePrView(viewed.stdout);
        prNumber = parsed.number;
        prUrl = parsed.url;
      }

      if (prNumber === undefined) {
        throw new Error('ERR_GH_PR_CREATE_FAILED');
      }

      runOrFail(runner, 'gh', ['pr', 'edit', String(prNumber), '--add-label', 'tier-3'], 'ERR_GH_PR_CREATE_FAILED');
    }
    emitState('PR_OPENED', { runId, prNumber, prUrl });
    emitState('COMPLETED', { runId });

    return buildResult({
      request: args,
      runIndex,
      runId,
      branchName,
      code: 'OK',
      mutatedFiles: [targetFile],
      appliedPatchId: buildPatchId(args, runIndex),
      prNumber,
      prUrl
    });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'ERR_SWARM_EXECUTION_FAILED';
    return buildFailureResult(message, safeRunIndex, safeRunId, safeBranchName);
  }
}

export const __testOnly = {
  buildRunId,
  buildBranchName,
  buildPatchId,
  buildCanonicalPrBody,
  sortStrings
};
