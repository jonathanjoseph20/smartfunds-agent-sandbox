import type { DatabaseSync } from 'node:sqlite';

import type { Goal } from '../models/goal.ts';
import { all, one } from './_shared.ts';

interface GoalRow {
  goal_id: string;
  project_id: string;
  team_id: string;
  title: string;
  goal_type: string;
  spec_ref: string | null;
  spec_json: string | null;
  archived_at: string | null;
}

function toGoal(row: GoalRow): Goal {
  return {
    goalId: row.goal_id,
    projectId: row.project_id,
    teamId: row.team_id,
    title: row.title,
    goalType: row.goal_type,
    specRef: row.spec_ref,
    specJson: row.spec_json,
    archivedAt: row.archived_at
  };
}

export function createGoal(db: DatabaseSync, goal: Goal): Goal {
  db.prepare(
    `INSERT INTO cockpit_goals
    (goal_id, project_id, team_id, title, goal_type, spec_ref, spec_json, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(goal.goalId, goal.projectId, goal.teamId, goal.title, goal.goalType, goal.specRef, goal.specJson, goal.archivedAt);
  return goal;
}

export function getGoalById(db: DatabaseSync, goalId: string): Goal | null {
  const row = one<GoalRow>(
    db,
    `SELECT goal_id, project_id, team_id, title, goal_type, spec_ref, spec_json, archived_at
     FROM cockpit_goals WHERE goal_id = ?`,
    goalId
  );
  return row ? toGoal(row) : null;
}

export function listGoalsByProjectId(db: DatabaseSync, projectId: string, includeArchived: boolean): Goal[] {
  const sql = includeArchived
    ? `SELECT goal_id, project_id, team_id, title, goal_type, spec_ref, spec_json, archived_at
       FROM cockpit_goals WHERE project_id = ? ORDER BY goal_id ASC`
    : `SELECT goal_id, project_id, team_id, title, goal_type, spec_ref, spec_json, archived_at
       FROM cockpit_goals WHERE project_id = ? AND archived_at IS NULL ORDER BY goal_id ASC`;
  return all<GoalRow>(db, sql, projectId).map(toGoal);
}

export function updateGoal(db: DatabaseSync, goal: Goal): Goal {
  db.prepare(
    `UPDATE cockpit_goals
     SET title = ?, goal_type = ?, spec_ref = ?, spec_json = ?, archived_at = ?
     WHERE goal_id = ?`
  ).run(goal.title, goal.goalType, goal.specRef, goal.specJson, goal.archivedAt, goal.goalId);
  return goal;
}
