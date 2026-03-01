import type { DatabaseSync } from 'node:sqlite';

import { sha256 } from '../../finance/determinism.ts';

export type TaskStatus = 'queued' | 'running' | 'done' | 'failed';

export interface TaskRecord {
  task_id: string;
  event_id: string;
  handler: string;
  attempt_index: number;
  status: TaskStatus;
  result_canonical: string | null;
  created_at: string;
}

export function computeTaskId(eventId: string, handler: string, attemptIndex: number): string {
  return sha256(`${eventId}\n${handler}\n${String(attemptIndex)}`);
}

export function insertQueuedTask(db: DatabaseSync, task: {
  task_id: string;
  event_id: string;
  handler: string;
  attempt_index: number;
  created_at: string;
}): void {
  db.prepare(`
    INSERT INTO tasks (task_id, event_id, handler, attempt_index, status, result_canonical, created_at)
    VALUES (?, ?, ?, ?, 'queued', NULL, ?)
  `).run(task.task_id, task.event_id, task.handler, task.attempt_index, task.created_at);
}

export function updateTaskStatus(db: DatabaseSync, taskId: string, status: TaskStatus, resultCanonical: string | null): void {
  db.prepare('UPDATE tasks SET status = ?, result_canonical = ? WHERE task_id = ?').run(status, resultCanonical, taskId);
}

export function getTaskById(db: DatabaseSync, taskId: string): TaskRecord | null {
  const row = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    task_id: row.task_id as string,
    event_id: row.event_id as string,
    handler: row.handler as string,
    attempt_index: row.attempt_index as number,
    status: row.status as TaskStatus,
    result_canonical: (row.result_canonical as string | null) ?? null,
    created_at: row.created_at as string
  };
}

export function countTasksByEventId(db: DatabaseSync, eventId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE event_id = ?').get(eventId) as { count: number };
  return row.count;
}
