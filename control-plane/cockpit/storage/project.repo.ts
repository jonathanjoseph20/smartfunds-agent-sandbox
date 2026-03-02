import type { DatabaseSync } from 'node:sqlite';

import type { Project } from '../models/project.ts';
import { all, one } from './_shared.ts';

interface ProjectRow {
  project_id: string;
  entity_id: string;
  name: string;
  archived_at: string | null;
  default_billing_profile_id: string | null;
}

function toProject(row: ProjectRow): Project {
  return {
    projectId: row.project_id,
    entityId: row.entity_id,
    name: row.name,
    archivedAt: row.archived_at,
    defaultBillingProfileId: row.default_billing_profile_id
  };
}

export function createProject(db: DatabaseSync, project: Project): Project {
  db.prepare(
    'INSERT INTO cockpit_projects (project_id, entity_id, name, archived_at, default_billing_profile_id) VALUES (?, ?, ?, ?, ?)'
  ).run(project.projectId, project.entityId, project.name, project.archivedAt, project.defaultBillingProfileId);
  return project;
}

export function getProjectById(db: DatabaseSync, projectId: string): Project | null {
  const row = one<ProjectRow>(
    db,
    'SELECT project_id, entity_id, name, archived_at, default_billing_profile_id FROM cockpit_projects WHERE project_id = ?',
    projectId
  );
  return row ? toProject(row) : null;
}

export function listProjects(db: DatabaseSync, includeArchived: boolean): Project[] {
  const sql = includeArchived
    ? 'SELECT project_id, entity_id, name, archived_at, default_billing_profile_id FROM cockpit_projects ORDER BY project_id ASC'
    : 'SELECT project_id, entity_id, name, archived_at, default_billing_profile_id FROM cockpit_projects WHERE archived_at IS NULL ORDER BY project_id ASC';
  return all<ProjectRow>(db, sql).map(toProject);
}

export function updateProject(db: DatabaseSync, project: Project): Project {
  db.prepare(
    `UPDATE cockpit_projects
     SET name = ?, archived_at = ?, default_billing_profile_id = ?
     WHERE project_id = ?`
  ).run(project.name, project.archivedAt, project.defaultBillingProfileId, project.projectId);

  return project;
}
