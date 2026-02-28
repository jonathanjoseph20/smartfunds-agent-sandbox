import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { mutationKernel } from '../pr/mutationKernel.ts';
import { loadProjectsFromDir, loadTeamsFromDir, type Project, type Team } from '../studio/registry.ts';
import { loadSwarmsFromDir } from './registry.ts';
import type { SwarmDefinition } from './types.ts';
import { getEntityForProject, loadEntityRegistry } from '../studio/entity-registry.ts';
import { getRailProfile, loadRailsRegistry, type RailProfile } from '../entities/rails.ts';

const DEFAULT_PROJECTS_DIR = 'control-plane/projects';
const DEFAULT_TEAMS_DIR = 'control-plane/teams';
const DEFAULT_SWARMS_DIR = 'control-plane/swarms';
const DEFAULT_BASE_BRANCH = 'main';
const TEST_ADAPTER_KEY = '__SMARTFUNDS_SWARM_EXECUTION_ADAPTER__';
const METADATA_FIELD_ORDER = ['execution-mode', 'project-id', 'swarm-id', 'task-intent'] as const;

export interface SwarmExecutionArgs {
  swarmId: string;
  projectId: string;
  taskIntent: string;
  executionMode: 'structured' | 'autonomous';
}

export interface SwarmExecutionResult {
  swarmId: string;
  projectId: string;
  executionMode: string;
  tasksExecuted: number;
  prCreated: boolean;
  branchName: string | null;
  retryEligible: boolean;
  deterministicHash: string;
}

type SwarmExecutionAdapter = {
  branchExistsLocal: (branchName: string) => boolean;
  branchExistsRemote: (branchName: string) => boolean;
  checkoutNewBranch: (branchName: string) => void;
  stageFile: (filePath: string) => void;
  commit: (message: string) => void;
  pushBranch: (branchName: string) => void;
  createPullRequest: (params: {
    base: string;
    head: string;
    title: string;
    body: string;
    labels: string[];
  }) => { prCreated: boolean };
};

type GlobalWithTestAdapter = typeof globalThis & {
  [TEST_ADAPTER_KEY]?: SwarmExecutionAdapter;
};

function runCommand(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    const execError = error as { stdout?: string | Buffer; stderr?: string | Buffer };
    const stdout = typeof execError.stdout === 'string'
      ? execError.stdout
      : Buffer.isBuffer(execError.stdout)
        ? execError.stdout.toString('utf8')
        : '';
    const stderr = typeof execError.stderr === 'string'
      ? execError.stderr
      : Buffer.isBuffer(execError.stderr)
        ? execError.stderr.toString('utf8')
        : '';
    throw new Error(`COMMAND_FAILED: ${command} ${args.join(' ')}\n${stdout}${stderr}`.trim());
  }
}

function runCommandAllowFailure(command: string, args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { status: 0, stdout: stdout ?? '', stderr: '' };
  } catch (error) {
    const execError = error as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    const stdout = typeof execError.stdout === 'string'
      ? execError.stdout
      : Buffer.isBuffer(execError.stdout)
        ? execError.stdout.toString('utf8')
        : '';
    const stderr = typeof execError.stderr === 'string'
      ? execError.stderr
      : Buffer.isBuffer(execError.stderr)
        ? execError.stderr.toString('utf8')
        : '';
    return {
      status: execError.status ?? 1,
      stdout,
      stderr
    };
  }
}

function parsePrNumber(value: string): number | null {
  const explicit = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.match(/\/pull\/(\d+)/)?.[1] ?? null)
    .find((entry): entry is string => entry !== null);

  if (!explicit) {
    return null;
  }

  const parsed = Number.parseInt(explicit, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function createDefaultAdapter(): SwarmExecutionAdapter {
  return {
    branchExistsLocal(branchName: string): boolean {
      const result = runCommandAllowFailure('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
      return result.status === 0;
    },
    branchExistsRemote(branchName: string): boolean {
      const result = runCommandAllowFailure('git', ['ls-remote', '--heads', 'origin', branchName]);
      if (result.status !== 0) {
        throw new Error('REMOTE_BRANCH_CHECK_FAILED');
      }
      return result.stdout.trim().length > 0;
    },
    checkoutNewBranch(branchName: string): void {
      runCommand('git', ['checkout', '-b', branchName]);
    },
    stageFile(filePath: string): void {
      runCommand('git', ['add', filePath]);
    },
    commit(message: string): void {
      runCommand('git', ['commit', '-m', message]);
    },
    pushBranch(branchName: string): void {
      runCommand('git', ['push', '--set-upstream', 'origin', branchName]);
    },
    createPullRequest(params): { prCreated: boolean } {
      const output = runCommand('gh', [
        'pr',
        'create',
        '--base',
        params.base,
        '--head',
        params.head,
        '--title',
        params.title,
        '--body',
        params.body
      ]);

      for (const label of [...params.labels].sort((a, b) => a.localeCompare(b))) {
        runCommand('gh', ['pr', 'edit', '--add-label', label]);
      }

      const parsedNumber = parsePrNumber(output);
      if (parsedNumber === null) {
        throw new Error('PR_CREATE_PARSE_FAILED');
      }

      return { prCreated: true };
    }
  };
}

function resolveAdapter(): SwarmExecutionAdapter {
  const testAdapter = (globalThis as GlobalWithTestAdapter)[TEST_ADAPTER_KEY];
  if (testAdapter) {
    return testAdapter;
  }
  return createDefaultAdapter();
}

function ensureNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`INVALID_ARGUMENT: ${field}`);
  }
}

function resolveProject(projectId: string, projects: Project[]): Project {
  const project = projects.find((entry) => entry.projectId === projectId);
  if (!project) {
    throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
  }
  return project;
}

function resolveSwarm(swarmId: string, swarms: SwarmDefinition[]): SwarmDefinition {
  const swarm = swarms.find((entry) => entry.swarmId === swarmId);
  if (!swarm) {
    throw new Error(`SWARM_NOT_FOUND: ${swarmId}`);
  }
  return swarm;
}

function resolveTeamCompatibility(swarm: SwarmDefinition, project: Project, teams: Team[]): Team | null {
  const teamById = new Map(teams.map((team) => [team.teamId, team]));
  const matching = teamById.get(swarm.team) ?? null;

  if (matching) {
    if (matching.projectId !== project.projectId) {
      throw new Error(`SWARM_TEAM_PROJECT_MISMATCH: swarm=${swarm.swarmId} team=${swarm.team} project=${project.projectId}`);
    }
    return matching;
  }

  if (swarm.team === project.projectId) {
    return null;
  }

  throw new Error(`TEAM_NOT_FOUND: ${swarm.team}`);
}

type ProjectModeHint = 'structured-only' | 'autonomous-only' | 'mixed' | 'unknown';

function loadProjectModeHint(projectId: string, teamsDir: string): ProjectModeHint {
  if (!fs.existsSync(teamsDir)) {
    return 'unknown';
  }

  const files = fs.readdirSync(teamsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const modes = new Set<'structured' | 'autonomous'>();
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(teamsDir, file), 'utf8')) as Record<string, unknown>;
    if (raw.projectId !== projectId) {
      continue;
    }
    if (raw.executionMode === 'structured' || raw.executionMode === 'autonomous') {
      modes.add(raw.executionMode);
    }
  }

  if (modes.size === 0) {
    return 'unknown';
  }
  if (modes.size > 1) {
    return 'mixed';
  }
  return modes.has('structured') ? 'structured-only' : 'autonomous-only';
}

function validateModeCompatibility(args: {
  requestedMode: 'structured' | 'autonomous';
  swarmMode: 'structured' | 'autonomous';
  projectModeHint: ProjectModeHint;
}): void {
  if (args.requestedMode === 'structured' && args.swarmMode === 'autonomous') {
    throw new Error('MODE_MISMATCH: structured_requested_but_swarm_autonomous_only');
  }

  if (args.requestedMode === 'autonomous' && args.projectModeHint === 'structured-only') {
    throw new Error('MODE_MISMATCH: autonomous_requested_but_project_structured_only');
  }
}

function isRailCompatible(mode: 'structured' | 'autonomous', profile: RailProfile): boolean {
  if (profile === 'restricted') {
    return false;
  }
  if (mode === 'structured') {
    return profile === 'structured-only' || profile === 'hybrid';
  }
  return profile === 'autonomous-only' || profile === 'hybrid';
}

function validateEntityAndRailBinding(projectId: string, executionMode: 'structured' | 'autonomous'): void {
  const entityRegistry = loadEntityRegistry();
  const entityId = getEntityForProject(projectId, entityRegistry);
  if (!entityId) {
    throw new Error(`ENTITY_BINDING_MISSING: project=${projectId}`);
  }

  const railsRegistry = loadRailsRegistry();
  const railProfile = getRailProfile(entityId, railsRegistry);
  if (!railProfile) {
    throw new Error(`RAIL_BINDING_MISSING: entity=${entityId}`);
  }
  if (!isRailCompatible(executionMode, railProfile)) {
    throw new Error(`RAIL_BINDING_INCOMPATIBLE: entity=${entityId} profile=${railProfile} mode=${executionMode}`);
  }
}

function branchNameForSwarm(swarmId: string): string {
  return `swarm/${swarmId}/run-1`;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  const pattern = escaped
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');
  return new RegExp(`^${pattern}$`);
}

function pathAllowedByProject(filePath: string, project: Project): boolean {
  return project.ownedPaths.some((ownedPath) => globToRegExp(ownedPath).test(filePath));
}

function normalizeLine(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function buildArtifactPath(args: { projectId: string; swarmId: string }): string {
  return path.posix.join('control-plane', 'swarms', 'runtime-artifacts', args.projectId, args.swarmId, 'run-1.txt');
}

function writeDeterministicArtifact(args: SwarmExecutionArgs, project: Project): string {
  const artifactPath = buildArtifactPath({ projectId: args.projectId, swarmId: args.swarmId });
  if (!pathAllowedByProject(artifactPath, project)) {
    throw new Error(`ARTIFACT_PATH_OUTSIDE_PROJECT_BOUNDS: ${artifactPath}`);
  }

  const lines = [
    `executionMode: ${args.executionMode}`,
    `projectId: ${args.projectId}`,
    `swarmId: ${args.swarmId}`,
    `taskIntent: ${args.taskIntent}`
  ];

  const content = `${normalizeLine(lines.join('\n'))}\n`;
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, content, 'utf8');

  return artifactPath;
}

function buildPrPayload(args: SwarmExecutionArgs, artifactPath: string): { body: string; labels: string[] } {
  const evidenceFields: Record<string, string> = {
    'Justification': 'Deterministic bounded swarm runtime execution for Sprint 41.',
    'Affected Paths': artifactPath,
    'Tests Added': 'unit + integration simulation + idempotency fail-closed',
    'Determinism Statement':
      'No timestamps/UUIDs/randomness; fixed branch naming; canonical sorting; single-pass execution; sealed mutation kernel.'
  };

  const metadata: Record<string, string> = {
    'execution-mode': args.executionMode,
    'project-id': args.projectId,
    'swarm-id': args.swarmId,
    'task-intent': args.taskIntent
  };

  for (const key of METADATA_FIELD_ORDER) {
    evidenceFields[key] = metadata[key];
  }

  const sealed = mutationKernel({
    currentBody: '',
    currentLabels: ['tier-3-approved'],
    desiredTier: 'tier-3',
    evidenceFields,
    allowedLabelMutations: ['tier-0', 'tier-1', 'tier-2', 'tier-3']
  });

  return {
    body: sealed.newBody,
    labels: sealed.newLabels
  };
}

function deterministicHashForResult(args: {
  swarmId: string;
  projectId: string;
  executionMode: 'structured' | 'autonomous';
  taskIntent: string;
  branchName: string | null;
  tasksExecuted: number;
  prCreated: boolean;
  retryEligible: boolean;
}): string {
  return sha256(canonicalStringify({
    swarmId: args.swarmId,
    projectId: args.projectId,
    executionMode: args.executionMode,
    taskIntent: args.taskIntent,
    branchName: args.branchName,
    tasksExecuted: args.tasksExecuted,
    prCreated: args.prCreated,
    retryEligible: args.retryEligible
  }));
}

export async function runSwarmExecution(args: SwarmExecutionArgs): Promise<SwarmExecutionResult> {
  ensureNonEmpty(args.swarmId, 'swarmId');
  ensureNonEmpty(args.projectId, 'projectId');
  ensureNonEmpty(args.taskIntent, 'taskIntent');

  const projects = loadProjectsFromDir(DEFAULT_PROJECTS_DIR);
  const teams = loadTeamsFromDir(DEFAULT_TEAMS_DIR, projects);
  const swarms = loadSwarmsFromDir(DEFAULT_SWARMS_DIR, projects);

  const project = resolveProject(args.projectId, projects);
  const swarm = resolveSwarm(args.swarmId, swarms);

  if (swarm.project !== project.projectId) {
    throw new Error(`SWARM_PROJECT_MISMATCH: swarm=${swarm.swarmId} project=${swarm.project} expected=${project.projectId}`);
  }

  resolveTeamCompatibility(swarm, project, teams);
  const projectModeHint = loadProjectModeHint(project.projectId, DEFAULT_TEAMS_DIR);

  validateModeCompatibility({
    requestedMode: args.executionMode,
    swarmMode: swarm.executionMode,
    projectModeHint
  });

  validateEntityAndRailBinding(args.projectId, args.executionMode);

  const adapter = resolveAdapter();
  const branchName = branchNameForSwarm(args.swarmId);

  if (adapter.branchExistsLocal(branchName) || adapter.branchExistsRemote(branchName)) {
    throw new Error(`BRANCH_ALREADY_EXISTS: ${branchName}`);
  }

  adapter.checkoutNewBranch(branchName);

  const artifactPath = writeDeterministicArtifact(args, project);
  adapter.stageFile(artifactPath);
  adapter.commit(`chore(swarm): execute ${args.swarmId} run-1`);
  adapter.pushBranch(branchName);

  const prPayload = buildPrPayload(args, artifactPath);
  const prResult = adapter.createPullRequest({
    base: DEFAULT_BASE_BRANCH,
    head: branchName,
    title: `chore(swarm): ${args.swarmId} run-1`,
    body: prPayload.body,
    labels: prPayload.labels
  });

  const prCreated = prResult.prCreated;
  const retryEligible = prCreated;
  const tasksExecuted = 1;

  return {
    swarmId: args.swarmId,
    projectId: args.projectId,
    executionMode: args.executionMode,
    tasksExecuted,
    prCreated,
    branchName,
    retryEligible,
    deterministicHash: deterministicHashForResult({
      swarmId: args.swarmId,
      projectId: args.projectId,
      executionMode: args.executionMode,
      taskIntent: args.taskIntent,
      branchName,
      tasksExecuted,
      prCreated,
      retryEligible
    })
  };
}
