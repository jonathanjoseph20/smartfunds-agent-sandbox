import type { DatabaseSync } from 'node:sqlite';

import type { Team } from '../models/team.ts';
import { all, one } from './_shared.ts';

interface TeamRow {
  team_id: string;
  project_id: string;
  name: string;
  archived_at: string | null;
}

function toTeam(row: TeamRow): Team {
  return {
    teamId: row.team_id,
    projectId: row.project_id,
    name: row.name,
    archivedAt: row.archived_at
  };
}

export function createTeam(db: DatabaseSync, team: Team): Team {
  db.prepare('INSERT INTO cockpit_teams (team_id, project_id, name, archived_at) VALUES (?, ?, ?, ?)').run(
    team.teamId,
    team.projectId,
    team.name,
    team.archivedAt
  );
  return team;
}

export function getTeamById(db: DatabaseSync, teamId: string): Team | null {
  const row = one<TeamRow>(db, 'SELECT team_id, project_id, name, archived_at FROM cockpit_teams WHERE team_id = ?', teamId);
  return row ? toTeam(row) : null;
}

export function listTeamsByProjectId(db: DatabaseSync, projectId: string, includeArchived: boolean): Team[] {
  const sql = includeArchived
    ? 'SELECT team_id, project_id, name, archived_at FROM cockpit_teams WHERE project_id = ? ORDER BY team_id ASC'
    : 'SELECT team_id, project_id, name, archived_at FROM cockpit_teams WHERE project_id = ? AND archived_at IS NULL ORDER BY team_id ASC';
  return all<TeamRow>(db, sql, projectId).map(toTeam);
}

export function updateTeam(db: DatabaseSync, team: Team): Team {
  db.prepare('UPDATE cockpit_teams SET name = ?, archived_at = ? WHERE team_id = ?').run(team.name, team.archivedAt, team.teamId);
  return team;
}
