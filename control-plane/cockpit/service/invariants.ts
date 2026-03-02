import type { DatabaseSync } from 'node:sqlite';

import {
  getBillingProfileById,
  getEntityById,
  getGoalById,
  getProjectById,
  getRoleById,
  getRunAttempt,
  getRunById,
  getTeamById
} from '../storage/index.ts';

export class CockpitError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'CockpitError';
    this.statusCode = statusCode;
  }
}

export function assertImmutableField(allowed: boolean, field: string): void {
  if (!allowed) {
    throw new CockpitError(409, `${field} is immutable`);
  }
}

export function requireEntity(db: DatabaseSync, entityId: string) {
  const entity = getEntityById(db, entityId);
  if (!entity) {
    throw new CockpitError(404, 'entity not found');
  }
  return entity;
}

export function requireProject(db: DatabaseSync, projectId: string) {
  const project = getProjectById(db, projectId);
  if (!project) {
    throw new CockpitError(404, 'project not found');
  }
  return project;
}

export function requireTeam(db: DatabaseSync, teamId: string) {
  const team = getTeamById(db, teamId);
  if (!team) {
    throw new CockpitError(404, 'team not found');
  }
  return team;
}

export function requireRole(db: DatabaseSync, roleId: string) {
  const role = getRoleById(db, roleId);
  if (!role) {
    throw new CockpitError(404, 'role not found');
  }
  return role;
}

export function requireGoal(db: DatabaseSync, goalId: string) {
  const goal = getGoalById(db, goalId);
  if (!goal) {
    throw new CockpitError(404, 'goal not found');
  }
  return goal;
}

export function requireRun(db: DatabaseSync, runId: string) {
  const run = getRunById(db, runId);
  if (!run) {
    throw new CockpitError(404, 'run not found');
  }
  return run;
}

export function requireRunAttemptRecord(db: DatabaseSync, runId: string, attemptIndex: number) {
  const runAttempt = getRunAttempt(db, runId, attemptIndex);
  if (!runAttempt) {
    throw new CockpitError(404, 'run attempt not found');
  }
  return runAttempt;
}

export function requireBillingProfile(db: DatabaseSync, billingProfileId: string) {
  const billingProfile = getBillingProfileById(db, billingProfileId);
  if (!billingProfile) {
    throw new CockpitError(404, 'billing profile not found');
  }
  return billingProfile;
}

export function assertSameProject(expectedProjectId: string, actualProjectId: string, message: string): void {
  if (expectedProjectId !== actualProjectId) {
    throw new CockpitError(409, message);
  }
}

export function assertGoalRunnable(archivedAt: string | null): void {
  if (archivedAt !== null) {
    throw new CockpitError(409, 'archived goal cannot start run');
  }
}
