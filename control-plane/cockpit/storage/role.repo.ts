import type { DatabaseSync } from 'node:sqlite';

import type { Role } from '../models/role.ts';
import { all, one } from './_shared.ts';

interface RoleRow {
  role_id: string;
  team_id: string;
  name: string;
  assignee_ref: string | null;
  archived_at: string | null;
}

function toRole(row: RoleRow): Role {
  return {
    roleId: row.role_id,
    teamId: row.team_id,
    name: row.name,
    assigneeRef: row.assignee_ref,
    archivedAt: row.archived_at
  };
}

export function createRole(db: DatabaseSync, role: Role): Role {
  db.prepare('INSERT INTO cockpit_roles (role_id, team_id, name, assignee_ref, archived_at) VALUES (?, ?, ?, ?, ?)').run(
    role.roleId,
    role.teamId,
    role.name,
    role.assigneeRef,
    role.archivedAt
  );
  return role;
}

export function getRoleById(db: DatabaseSync, roleId: string): Role | null {
  const row = one<RoleRow>(
    db,
    'SELECT role_id, team_id, name, assignee_ref, archived_at FROM cockpit_roles WHERE role_id = ?',
    roleId
  );
  return row ? toRole(row) : null;
}

export function listRolesByTeamId(db: DatabaseSync, teamId: string, includeArchived: boolean): Role[] {
  const sql = includeArchived
    ? 'SELECT role_id, team_id, name, assignee_ref, archived_at FROM cockpit_roles WHERE team_id = ? ORDER BY role_id ASC'
    : 'SELECT role_id, team_id, name, assignee_ref, archived_at FROM cockpit_roles WHERE team_id = ? AND archived_at IS NULL ORDER BY role_id ASC';
  return all<RoleRow>(db, sql, teamId).map(toRole);
}

export function updateRole(db: DatabaseSync, role: Role): Role {
  db.prepare('UPDATE cockpit_roles SET name = ?, assignee_ref = ?, archived_at = ? WHERE role_id = ?').run(
    role.name,
    role.assigneeRef,
    role.archivedAt,
    role.roleId
  );
  return role;
}
