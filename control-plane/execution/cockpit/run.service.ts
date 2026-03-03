import fs from 'node:fs';
import path from 'node:path';

import { createRunObject } from './run.model.ts';
import { createCockpitRunRepo, type CockpitRunRepo } from './run.repo.ts';
import { parseCreateRunInput } from './run.schema.ts';
import type { CockpitGoal, CreateRunInput, Run } from './run.types.ts';

type CockpitGoalStorage = {
  goals: CockpitGoal[];
};

export class CockpitRunServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'CockpitRunServiceError';
  }
}

function stableGoal(goal: CockpitGoal): CockpitGoal {
  return {
    goalId: goal.goalId,
    projectId: goal.projectId,
    teamId: goal.teamId
  };
}

function sortGoals(goals: CockpitGoal[]): CockpitGoal[] {
  return [...goals].sort((left, right) => {
    const goalCmp = left.goalId.localeCompare(right.goalId);
    if (goalCmp !== 0) {
      return goalCmp;
    }
    const projectCmp = left.projectId.localeCompare(right.projectId);
    if (projectCmp !== 0) {
      return projectCmp;
    }
    return left.teamId.localeCompare(right.teamId);
  });
}

function isCockpitGoal(value: unknown): value is CockpitGoal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const goal = value as Record<string, unknown>;
  return typeof goal.goalId === 'string' && goal.goalId.trim().length > 0
    && typeof goal.projectId === 'string' && goal.projectId.trim().length > 0
    && typeof goal.teamId === 'string' && goal.teamId.trim().length > 0;
}

function parseGoalStorage(raw: unknown): CockpitGoalStorage {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { goals: [] };
  }

  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.goals)) {
    return { goals: [] };
  }

  return {
    goals: sortGoals(record.goals.filter(isCockpitGoal)).map(stableGoal)
  };
}

export type CockpitRunService = {
  createRun: (input: CreateRunInput) => Run;
};

export function createCockpitRunService(options: { runsPath?: string; goalsPath?: string; repo?: CockpitRunRepo } = {}): CockpitRunService {
  const goalsPath = options.goalsPath ?? path.resolve('control-plane/execution/storage/cockpit-goals.json');
  const repo = options.repo ?? createCockpitRunRepo({ storagePath: options.runsPath });

  function ensureGoalStorageExists(): void {
    const dir = path.dirname(goalsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(goalsPath)) {
      fs.writeFileSync(goalsPath, '{"goals":[]}\n', 'utf8');
    }
  }

  function loadGoals(): CockpitGoal[] {
    ensureGoalStorageExists();
    const raw = JSON.parse(fs.readFileSync(goalsPath, 'utf8')) as unknown;
    return parseGoalStorage(raw).goals;
  }

  return {
    createRun(input: CreateRunInput): Run {
      const parsed = parseCreateRunInput(input);
      const goals = loadGoals();
      const goal = goals.find((entry) => entry.goalId === parsed.goalId);

      if (!goal) {
        throw new CockpitRunServiceError('ERR_COCKPIT_GOAL_NOT_FOUND', `Goal not found: ${parsed.goalId}`);
      }

      if (goal.projectId !== parsed.projectId || goal.teamId !== parsed.teamId) {
        throw new CockpitRunServiceError(
          'ERR_COCKPIT_GOAL_SCOPE_MISMATCH',
          `Goal ${parsed.goalId} does not match project/team scope.`
        );
      }

      const attemptIndex = repo
        .listRunsByGoal(parsed.goalId)
        .filter((run) => run.projectId === parsed.projectId && run.teamId === parsed.teamId)
        .reduce((max, run) => (run.attemptIndex > max ? run.attemptIndex : max), 0) + 1;

      const run = createRunObject({
        projectId: parsed.projectId,
        teamId: parsed.teamId,
        goalId: parsed.goalId,
        attemptIndex
      });

      return repo.createRun(run);
    }
  };
}
