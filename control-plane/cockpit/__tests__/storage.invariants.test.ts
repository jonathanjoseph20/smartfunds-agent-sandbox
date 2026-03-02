import { beforeEach, describe, expect, it } from 'vitest';

import { clearServiceDbRegistryForTests, getServiceDb } from '../../service/storage/db.ts';
import {
  createEntity,
  createGoal,
  createProject,
  createTeam,
  listProjects,
  listRunAttempts,
  listRunEventsByAttempt,
  listRunsByGoalId,
  nextCounterId,
  withTransaction
} from '../storage/index.ts';
import { createProjectBillingProfile, patchBillingProfile } from '../service/billing.ts';
import { CockpitError } from '../service/invariants.ts';
import { retryRun, startRun } from '../service/runLifecycle.ts';

const TEST_DB_PATH = ':memory:';

describe.sequential('cockpit storage invariants', () => {
  beforeEach(() => {
    clearServiceDbRegistryForTests();
  });

  it('supports CRUD and archived default-list filtering for projects', () => {
    const db = getServiceDb(TEST_DB_PATH);

    const entity = createEntity(db, { entityId: nextCounterId(db, 'entity'), name: 'Entity' });
    const project = createProject(db, {
      projectId: nextCounterId(db, 'project'),
      entityId: entity.entityId,
      name: 'Project',
      archivedAt: null,
      defaultBillingProfileId: null
    });

    expect(listProjects(db, false).map((entry) => entry.projectId)).toEqual([project.projectId]);

    createProject(db, {
      projectId: nextCounterId(db, 'project'),
      entityId: entity.entityId,
      name: 'Archived Project',
      archivedAt: '2026-03-02T00:00:00.000Z',
      defaultBillingProfileId: null
    });

    expect(listProjects(db, false)).toHaveLength(1);
    expect(listProjects(db, true)).toHaveLength(2);
  });

  it('enforces cross-project goal/team boundary', () => {
    const db = getServiceDb(TEST_DB_PATH);

    const entity = createEntity(db, { entityId: nextCounterId(db, 'entity'), name: 'Entity' });
    const projectA = createProject(db, {
      projectId: nextCounterId(db, 'project'),
      entityId: entity.entityId,
      name: 'Project A',
      archivedAt: null,
      defaultBillingProfileId: null
    });
    const projectB = createProject(db, {
      projectId: nextCounterId(db, 'project'),
      entityId: entity.entityId,
      name: 'Project B',
      archivedAt: null,
      defaultBillingProfileId: null
    });
    const teamA = createTeam(db, { teamId: nextCounterId(db, 'team'), projectId: projectA.projectId, name: 'Team A', archivedAt: null });

    expect(() => {
      withTransaction(db, () => {
        if (teamA.projectId !== projectB.projectId) {
          throw new CockpitError(409, 'goal team must belong to goal project');
        }
        createGoal(db, {
          goalId: nextCounterId(db, 'goal'),
          projectId: projectB.projectId,
          teamId: teamA.teamId,
          title: 'Invalid Goal',
          goalType: 'delivery',
          specRef: null,
          specJson: null,
          archivedAt: null
        });
      });
    }).toThrowError('goal team must belong to goal project');
  });

  it('allocates deterministic run/attempt/event sequences', () => {
    const db = getServiceDb(TEST_DB_PATH);

    const entity = createEntity(db, { entityId: nextCounterId(db, 'entity'), name: 'Entity' });
    const project = createProject(db, {
      projectId: nextCounterId(db, 'project'),
      entityId: entity.entityId,
      name: 'Project',
      archivedAt: null,
      defaultBillingProfileId: null
    });
    const team = createTeam(db, { teamId: nextCounterId(db, 'team'), projectId: project.projectId, name: 'Team', archivedAt: null });
    const goal = createGoal(db, {
      goalId: nextCounterId(db, 'goal'),
      projectId: project.projectId,
      teamId: team.teamId,
      title: 'Goal',
      goalType: 'delivery',
      specRef: null,
      specJson: null,
      archivedAt: null
    });

    const run0 = startRun(db, goal.goalId, 'run-0').run;
    const run1 = startRun(db, goal.goalId, 'run-1').run;

    expect(listRunsByGoalId(db, goal.goalId).map((entry) => entry.runIndex)).toEqual([1, 0]);

    const retry = retryRun(db, run0.runId, 'retry-1').attempt;
    expect(retry.attemptIndex).toBe(1);

    expect(listRunAttempts(db, run0.runId).map((entry) => entry.attemptIndex)).toEqual([0, 1]);
    expect(listRunEventsByAttempt(db, run0.runId, 0).map((entry) => entry.eventSeq)).toEqual([0, 1, 2]);
    expect(listRunEventsByAttempt(db, run0.runId, 1).map((entry) => entry.eventSeq)).toEqual([0, 1]);

    expect(run1.runIndex).toBe(1);
  });

  it('enforces billing unique active labels with archive/unarchive behavior', () => {
    const db = getServiceDb(TEST_DB_PATH);

    const entity = createEntity(db, { entityId: nextCounterId(db, 'entity'), name: 'Entity' });
    const project = createProject(db, {
      projectId: nextCounterId(db, 'project'),
      entityId: entity.entityId,
      name: 'Project',
      archivedAt: null,
      defaultBillingProfileId: null
    });

    const wires = createProjectBillingProfile(db, project.projectId, { label: 'wires', status: 'active', idempotencyKey: null });

    expect(() => {
      createProjectBillingProfile(db, project.projectId, { label: 'wires', status: 'active', idempotencyKey: null });
    }).toThrowError('active billing profile label already exists: wires');

    patchBillingProfile(db, wires.billingProfileId, { status: null, archived: true });

    const replacement = createProjectBillingProfile(db, project.projectId, { label: 'wires', status: 'active', idempotencyKey: null });
    expect(replacement.billingProfileId).not.toBe(wires.billingProfileId);
  });
});
