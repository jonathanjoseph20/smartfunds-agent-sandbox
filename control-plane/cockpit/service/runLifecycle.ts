import type { DatabaseSync } from 'node:sqlite';

import { canonicalStringify } from '../../finance/determinism.ts';
import type { ApprovalRequest } from '../models/approvalRequest.ts';
import type { PRArtifact } from '../models/prArtifact.ts';
import type { Run } from '../models/run.ts';
import type { RunAttempt } from '../models/runAttempt.ts';
import type { RunEvent } from '../models/runEvent.ts';
import {
  appendRunEvent,
  createRun,
  createRunAttempt,
  getGoalById,
  getRunAttempt,
  getRunById,
  listApprovalRequestsByRun,
  listPRArtifactsByRun,
  listRunAttempts,
  listRunEventsByAttempt,
  listRunsByGoalId,
  nextAttemptIndex,
  nextCounterId,
  nextEventSeq,
  nextRunIndex,
  updateRunStatus,
  withTransaction
} from '../storage/index.ts';
import { assertGoalRunnable, CockpitError, requireGoal, requireRun, requireRunAttemptRecord } from './invariants.ts';
import { resolveIdempotentResource, saveIdempotencyResource } from './idempotency.ts';

function appendEvent(
  db: DatabaseSync,
  runId: string,
  attemptIndex: number,
  type: string,
  payload: Record<string, unknown> | null
): RunEvent {
  const eventSeq = nextEventSeq(db, runId, attemptIndex);
  return appendRunEvent(db, {
    runId,
    attemptIndex,
    eventSeq,
    type,
    payloadJson: payload === null ? null : canonicalStringify(payload),
    envelopeHash: null
  });
}

export function startRun(
  db: DatabaseSync,
  goalId: string,
  idempotencyKey: string | null
): { run: Run; created: boolean } {
  return withTransaction(db, () => {
    const goal = requireGoal(db, goalId);
    assertGoalRunnable(goal.archivedAt);

    const scope = `start-run:${goalId}`;
    const existingReference = resolveIdempotentResource(db, scope, idempotencyKey);
    if (existingReference?.resourceType === 'run') {
      const existing = getRunById(db, existingReference.resourceId);
      if (existing) {
        return { run: existing, created: false };
      }
    }

    if (idempotencyKey) {
      const existingByRunIdempotency = db.prepare(
        'SELECT run_id FROM cockpit_runs WHERE goal_id = ? AND idempotency_key = ?'
      ).get(goalId, idempotencyKey) as { run_id: string } | undefined;
      if (existingByRunIdempotency) {
        const existing = requireRun(db, existingByRunIdempotency.run_id);
        saveIdempotencyResource(db, scope, idempotencyKey, 'run', existing.runId);
        return { run: existing, created: false };
      }
    }

    const runId = nextCounterId(db, 'run');
    const runIndex = nextRunIndex(db, goalId);
    const run: Run = {
      runId,
      projectId: goal.projectId,
      goalId,
      runIndex,
      status: 'running',
      idempotencyKey
    };
    createRun(db, run);

    const attempt: RunAttempt = {
      runId,
      attemptIndex: 0,
      status: 'running',
      idempotencyKey: null
    };
    createRunAttempt(db, attempt);

    appendEvent(db, runId, 0, 'RUN_CREATED', { runId, goalId, runIndex });
    appendEvent(db, runId, 0, 'ATTEMPT_CREATED', { runId, attemptIndex: 0 });
    appendEvent(db, runId, 0, 'ATTEMPT_STARTED', { runId, attemptIndex: 0 });

    saveIdempotencyResource(db, scope, idempotencyKey, 'run', runId);
    return { run, created: true };
  });
}

export function retryRun(
  db: DatabaseSync,
  runId: string,
  idempotencyKey: string | null
): { attempt: RunAttempt; created: boolean } {
  return withTransaction(db, () => {
    requireRun(db, runId);

    const scope = `retry-run:${runId}`;
    const existingReference = resolveIdempotentResource(db, scope, idempotencyKey);
    if (existingReference?.resourceType === 'run_attempt') {
      const [existingRunId, attemptIndexText] = existingReference.resourceId.split(':');
      if (existingRunId === runId) {
        const existingAttempt = getRunAttempt(db, runId, Number(attemptIndexText));
        if (existingAttempt) {
          return { attempt: existingAttempt, created: false };
        }
      }
    }

    if (idempotencyKey) {
      const existingByAttemptIdempotency = db.prepare(
        'SELECT attempt_index FROM cockpit_run_attempts WHERE run_id = ? AND idempotency_key = ?'
      ).get(runId, idempotencyKey) as { attempt_index: number } | undefined;
      if (existingByAttemptIdempotency) {
        const existing = requireRunAttemptRecord(db, runId, existingByAttemptIdempotency.attempt_index);
        saveIdempotencyResource(db, scope, idempotencyKey, 'run_attempt', `${runId}:${String(existing.attemptIndex)}`);
        return { attempt: existing, created: false };
      }
    }

    const attemptIndex = nextAttemptIndex(db, runId);
    const attempt: RunAttempt = {
      runId,
      attemptIndex,
      status: 'running',
      idempotencyKey
    };
    createRunAttempt(db, attempt);
    updateRunStatus(db, runId, 'running');

    appendEvent(db, runId, attemptIndex, 'ATTEMPT_CREATED', { runId, attemptIndex });
    appendEvent(db, runId, attemptIndex, 'ATTEMPT_STARTED', { runId, attemptIndex });

    saveIdempotencyResource(db, scope, idempotencyKey, 'run_attempt', `${runId}:${String(attemptIndex)}`);
    return { attempt, created: true };
  });
}

export function listGoalRuns(db: DatabaseSync, goalId: string): Run[] {
  const goal = getGoalById(db, goalId);
  if (!goal) {
    throw new CockpitError(404, 'goal not found');
  }
  return listRunsByGoalId(db, goalId);
}

export interface RunDetailAttempt {
  attempt: RunAttempt;
  events: RunEvent[];
  approvals: ApprovalRequest[];
  artifacts: PRArtifact[];
}

export interface RunDetail {
  run: Run;
  attempts: RunDetailAttempt[];
}

export function getRunDetail(db: DatabaseSync, runId: string): RunDetail {
  const run = requireRun(db, runId);
  const attempts = listRunAttempts(db, runId);
  const approvals = listApprovalRequestsByRun(db, runId);
  const artifacts = listPRArtifactsByRun(db, runId);

  return {
    run,
    attempts: attempts.map((attempt) => ({
      attempt,
      events: listRunEventsByAttempt(db, runId, attempt.attemptIndex),
      approvals: approvals.filter((entry) => entry.attemptIndex === attempt.attemptIndex),
      artifacts: artifacts.filter((entry) => entry.attemptIndex === attempt.attemptIndex)
    }))
  };
}
