import type { CreateRunInput, Run, RunStatus } from './run.types.ts';

const RUN_STATUSES: RunStatus[] = ['created', 'running', 'completed', 'failed'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseCreateRunInput(value: unknown): CreateRunInput {
  if (!isPlainObject(value)) {
    throw new Error('ERR_COCKPIT_INVALID_RUN_INPUT');
  }

  const projectId = value.projectId;
  const teamId = value.teamId;
  const goalId = value.goalId;

  if (!isNonEmptyString(projectId) || !isNonEmptyString(teamId) || !isNonEmptyString(goalId)) {
    throw new Error('ERR_COCKPIT_INVALID_RUN_INPUT');
  }

  return {
    projectId: projectId.trim(),
    teamId: teamId.trim(),
    goalId: goalId.trim()
  };
}

export function assertValidRun(run: Run): void {
  if (!isNonEmptyString(run.runId)) {
    throw new Error('ERR_COCKPIT_INVALID_RUN');
  }
  if (!isNonEmptyString(run.projectId) || !isNonEmptyString(run.teamId) || !isNonEmptyString(run.goalId)) {
    throw new Error('ERR_COCKPIT_INVALID_RUN');
  }
  if (run.executionMode !== 'structured') {
    throw new Error('ERR_COCKPIT_INVALID_RUN');
  }
  if (!RUN_STATUSES.includes(run.status)) {
    throw new Error('ERR_COCKPIT_INVALID_RUN');
  }
  if (!Number.isInteger(run.attemptIndex) || run.attemptIndex < 1) {
    throw new Error('ERR_COCKPIT_INVALID_RUN');
  }
}
