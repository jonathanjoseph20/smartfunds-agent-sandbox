import { beforeEach, describe, expect, it } from 'vitest';

import { createServiceDispatcher } from '../../service/index.ts';
import { clearServiceDbRegistryForTests, getServiceDb } from '../../service/storage/db.ts';
import { updateRunAttemptStatus } from '../storage/runAttempt.repo.ts';

const TEST_DB_PATH = ':memory:';

async function dispatch(
  runtimeDispatch: ReturnType<typeof createServiceDispatcher>,
  method: string,
  pathname: string,
  body: unknown,
  query?: URLSearchParams
) {
  return runtimeDispatch({
    method,
    pathname,
    bodyText: body === null ? null : JSON.stringify(body),
    query
  });
}

describe.sequential('cockpit api contract', () => {
  beforeEach(() => {
    clearServiceDbRegistryForTests();
  });

  it('Test 1 — Project→Team→Goal→Run attempt 0', async () => {
    const runtimeDispatch = createServiceDispatcher({ dbPath: TEST_DB_PATH, now: () => '2026-03-02T00:00:00.000Z' });

    const entity = await dispatch(runtimeDispatch, 'POST', '/api/entities', { name: 'Entity A', idempotencyKey: 'e1' });
    expect(entity.statusCode).toBe(201);

    const project = await dispatch(runtimeDispatch, 'POST', '/api/projects', {
      entityId: (entity.payload as { entityId: string }).entityId,
      name: 'Project A',
      idempotencyKey: 'p1'
    });
    expect(project.statusCode).toBe(201);

    const team = await dispatch(runtimeDispatch, 'POST', '/api/teams', {
      projectId: (project.payload as { projectId: string }).projectId,
      name: 'Team A',
      idempotencyKey: 't1'
    });
    expect(team.statusCode).toBe(201);

    const goal = await dispatch(runtimeDispatch, 'POST', '/api/goals', {
      projectId: (project.payload as { projectId: string }).projectId,
      teamId: (team.payload as { teamId: string }).teamId,
      title: 'Goal A',
      goalType: 'delivery',
      specJson: { b: 2, a: 1 },
      idempotencyKey: 'g1'
    });
    expect(goal.statusCode).toBe(201);

    const startRun = await dispatch(runtimeDispatch, 'POST', `/api/goals/${(goal.payload as { goalId: string }).goalId}/runs`, {
      idempotencyKey: 'run-1'
    });
    expect(startRun.statusCode).toBe(201);
    expect(startRun.payload).toMatchObject({ runIndex: 0 });

    const runDetail = await dispatch(
      runtimeDispatch,
      'GET',
      `/api/runs/${(startRun.payload as { runId: string }).runId}`,
      null
    );
    expect(runDetail.statusCode).toBe(200);

    const attempts = (runDetail.payload as { attempts: Array<{ events: Array<{ eventSeq: number }> }> }).attempts;
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.events.map((event) => event.eventSeq)).toEqual([0, 1, 2]);
  });

  it('Test 2 — Approval request + immutable decision + timeline', async () => {
    const runtimeDispatch = createServiceDispatcher({ dbPath: TEST_DB_PATH, now: () => '2026-03-02T00:00:00.000Z' });

    const entity = await dispatch(runtimeDispatch, 'POST', '/api/entities', { name: 'Entity A' });
    const project = await dispatch(runtimeDispatch, 'POST', '/api/projects', {
      entityId: (entity.payload as { entityId: string }).entityId,
      name: 'Project A'
    });
    const team = await dispatch(runtimeDispatch, 'POST', '/api/teams', {
      projectId: (project.payload as { projectId: string }).projectId,
      name: 'Team A'
    });
    const goal = await dispatch(runtimeDispatch, 'POST', '/api/goals', {
      projectId: (project.payload as { projectId: string }).projectId,
      teamId: (team.payload as { teamId: string }).teamId,
      title: 'Goal A',
      goalType: 'delivery'
    });
    const run = await dispatch(runtimeDispatch, 'POST', `/api/goals/${(goal.payload as { goalId: string }).goalId}/runs`, {});

    const createApproval = await dispatch(
      runtimeDispatch,
      'POST',
      `/api/runs/${(run.payload as { runId: string }).runId}/attempts/0/approvals`,
      { actionType: 'merge', actionPayload: { x: 1 } }
    );
    expect(createApproval.statusCode).toBe(201);

    const approve = await dispatch(
      runtimeDispatch,
      'POST',
      `/api/approvals/${(createApproval.payload as { approvalRequestId: string }).approvalRequestId}/approve`,
      { decisionReason: 'ok' }
    );
    expect(approve.statusCode).toBe(200);

    const denyAfterApprove = await dispatch(
      runtimeDispatch,
      'POST',
      `/api/approvals/${(createApproval.payload as { approvalRequestId: string }).approvalRequestId}/deny`,
      { decisionReason: 'late deny' }
    );
    expect(denyAfterApprove.statusCode).toBe(409);

    const detail = await dispatch(runtimeDispatch, 'GET', `/api/runs/${(run.payload as { runId: string }).runId}`, null);
    const events = (detail.payload as { attempts: Array<{ events: Array<{ type: string }> }> }).attempts[0]?.events ?? [];
    expect(events.some((entry) => entry.type === 'APPROVAL_REQUESTED')).toBe(true);
    expect(events.some((entry) => entry.type === 'APPROVAL_DECIDED')).toBe(true);
  });

  it('Test 3 — Retry creates attempt 1 under same run', async () => {
    const runtimeDispatch = createServiceDispatcher({ dbPath: TEST_DB_PATH, now: () => '2026-03-02T00:00:00.000Z' });

    const entity = await dispatch(runtimeDispatch, 'POST', '/api/entities', { name: 'Entity A' });
    const project = await dispatch(runtimeDispatch, 'POST', '/api/projects', {
      entityId: (entity.payload as { entityId: string }).entityId,
      name: 'Project A'
    });
    const team = await dispatch(runtimeDispatch, 'POST', '/api/teams', {
      projectId: (project.payload as { projectId: string }).projectId,
      name: 'Team A'
    });
    const goal = await dispatch(runtimeDispatch, 'POST', '/api/goals', {
      projectId: (project.payload as { projectId: string }).projectId,
      teamId: (team.payload as { teamId: string }).teamId,
      title: 'Goal A',
      goalType: 'delivery'
    });
    const run = await dispatch(runtimeDispatch, 'POST', `/api/goals/${(goal.payload as { goalId: string }).goalId}/runs`, {});

    const runId = (run.payload as { runId: string }).runId;
    const db = getServiceDb(TEST_DB_PATH);
    updateRunAttemptStatus(db, runId, 0, 'failed');

    const retry = await dispatch(runtimeDispatch, 'POST', `/api/runs/${runId}/retry`, { idempotencyKey: 'retry-1' });
    expect(retry.statusCode).toBe(201);
    expect(retry.payload).toMatchObject({ attemptIndex: 1 });

    const detail = await dispatch(runtimeDispatch, 'GET', `/api/runs/${runId}`, null);
    const attempts = (detail.payload as { attempts: Array<{ attempt: { attemptIndex: number } }> }).attempts;
    expect(attempts.map((entry) => entry.attempt.attemptIndex)).toEqual([0, 1]);
  });

  it('Test 4 — Archived goal cannot run', async () => {
    const runtimeDispatch = createServiceDispatcher({ dbPath: TEST_DB_PATH, now: () => '2026-03-02T00:00:00.000Z' });

    const entity = await dispatch(runtimeDispatch, 'POST', '/api/entities', { name: 'Entity A' });
    const project = await dispatch(runtimeDispatch, 'POST', '/api/projects', {
      entityId: (entity.payload as { entityId: string }).entityId,
      name: 'Project A'
    });
    const team = await dispatch(runtimeDispatch, 'POST', '/api/teams', {
      projectId: (project.payload as { projectId: string }).projectId,
      name: 'Team A'
    });
    const goal = await dispatch(runtimeDispatch, 'POST', '/api/goals', {
      projectId: (project.payload as { projectId: string }).projectId,
      teamId: (team.payload as { teamId: string }).teamId,
      title: 'Goal A',
      goalType: 'delivery'
    });

    const goalId = (goal.payload as { goalId: string }).goalId;
    const archive = await dispatch(runtimeDispatch, 'PATCH', `/api/goals/${goalId}`, { archived: true });
    expect(archive.statusCode).toBe(200);

    const blockedRun = await dispatch(runtimeDispatch, 'POST', `/api/goals/${goalId}/runs`, {});
    expect(blockedRun.statusCode).toBe(409);

    const unarchive = await dispatch(runtimeDispatch, 'PATCH', `/api/goals/${goalId}`, { archived: false });
    expect(unarchive.statusCode).toBe(200);

    const run = await dispatch(runtimeDispatch, 'POST', `/api/goals/${goalId}/runs`, {});
    expect(run.statusCode).toBe(201);
  });

  it('Test 5 — Billing profiles unique active label', async () => {
    const runtimeDispatch = createServiceDispatcher({ dbPath: TEST_DB_PATH, now: () => '2026-03-02T00:00:00.000Z' });

    const entity = await dispatch(runtimeDispatch, 'POST', '/api/entities', { name: 'Entity A' });
    const project = await dispatch(runtimeDispatch, 'POST', '/api/projects', {
      entityId: (entity.payload as { entityId: string }).entityId,
      name: 'Project A'
    });
    const projectId = (project.payload as { projectId: string }).projectId;

    const wires = await dispatch(runtimeDispatch, 'POST', `/api/projects/${projectId}/billing-profiles`, {
      label: 'wires',
      status: 'active'
    });
    const stablecoins = await dispatch(runtimeDispatch, 'POST', `/api/projects/${projectId}/billing-profiles`, {
      label: 'stablecoins',
      status: 'active'
    });
    expect(wires.statusCode).toBe(201);
    expect(stablecoins.statusCode).toBe(201);

    const duplicateWires = await dispatch(runtimeDispatch, 'POST', `/api/projects/${projectId}/billing-profiles`, {
      label: 'wires',
      status: 'active'
    });
    expect(duplicateWires.statusCode).toBe(409);

    const archivedWires = await dispatch(
      runtimeDispatch,
      'PATCH',
      `/api/billing-profiles/${(wires.payload as { billingProfileId: string }).billingProfileId}`,
      { archived: true }
    );
    expect(archivedWires.statusCode).toBe(200);

    const newWires = await dispatch(runtimeDispatch, 'POST', `/api/projects/${projectId}/billing-profiles`, {
      label: 'wires',
      status: 'active'
    });
    expect(newWires.statusCode).toBe(201);
  });

  it('enforces idempotency, cross-project rejection, immutability rejection, and archived default lists', async () => {
    const runtimeDispatch = createServiceDispatcher({ dbPath: TEST_DB_PATH, now: () => '2026-03-02T00:00:00.000Z' });

    const entity = await dispatch(runtimeDispatch, 'POST', '/api/entities', { name: 'Entity A', idempotencyKey: 'entity-a' });
    const entityId = (entity.payload as { entityId: string }).entityId;
    const projectA = await dispatch(runtimeDispatch, 'POST', '/api/projects', { entityId, name: 'Project A' });
    const projectB = await dispatch(runtimeDispatch, 'POST', '/api/projects', { entityId, name: 'Project B' });
    const projectAId = (projectA.payload as { projectId: string }).projectId;
    const projectBId = (projectB.payload as { projectId: string }).projectId;

    const teamA = await dispatch(runtimeDispatch, 'POST', '/api/teams', { projectId: projectAId, name: 'Team A' });
    const teamAId = (teamA.payload as { teamId: string }).teamId;

    const crossProjectGoal = await dispatch(runtimeDispatch, 'POST', '/api/goals', {
      projectId: projectBId,
      teamId: teamAId,
      title: 'Invalid Goal',
      goalType: 'delivery'
    });
    expect(crossProjectGoal.statusCode).toBe(409);

    const goal = await dispatch(runtimeDispatch, 'POST', '/api/goals', {
      projectId: projectAId,
      teamId: teamAId,
      title: 'Goal A',
      goalType: 'delivery'
    });
    const goalId = (goal.payload as { goalId: string }).goalId;

    const mutateImmutableGoal = await dispatch(runtimeDispatch, 'PATCH', `/api/goals/${goalId}`, {
      projectId: projectBId
    });
    expect(mutateImmutableGoal.statusCode).toBe(409);

    const runOne = await dispatch(runtimeDispatch, 'POST', `/api/goals/${goalId}/runs`, { idempotencyKey: 'run-idempotent' });
    const runTwo = await dispatch(runtimeDispatch, 'POST', `/api/goals/${goalId}/runs`, { idempotencyKey: 'run-idempotent' });
    expect(runOne.statusCode).toBe(201);
    expect(runTwo.statusCode).toBe(200);
    expect((runOne.payload as { runId: string }).runId).toBe((runTwo.payload as { runId: string }).runId);

    await dispatch(runtimeDispatch, 'PATCH', `/api/projects/${projectBId}`, { archived: true });
    const activeOnly = await dispatch(runtimeDispatch, 'GET', '/api/projects', null);
    const withArchived = await dispatch(runtimeDispatch, 'GET', '/api/projects', null, new URLSearchParams({ includeArchived: 'true' }));

    expect((activeOnly.payload as Array<{ projectId: string }>).map((entry) => entry.projectId)).toEqual([projectAId]);
    expect((withArchived.payload as Array<{ projectId: string }>).map((entry) => entry.projectId)).toEqual([projectAId, projectBId]);
  });
});
