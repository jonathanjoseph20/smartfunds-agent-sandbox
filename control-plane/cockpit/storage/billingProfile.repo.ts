import type { DatabaseSync } from 'node:sqlite';

import type { BillingProfile } from '../models/billingProfile.ts';
import { all, one } from './_shared.ts';

interface BillingProfileRow {
  billing_profile_id: string;
  entity_id: string;
  project_id: string;
  label: string;
  status: 'active' | 'disabled';
  archived_at: string | null;
}

function toBillingProfile(row: BillingProfileRow): BillingProfile {
  return {
    billingProfileId: row.billing_profile_id,
    entityId: row.entity_id,
    projectId: row.project_id,
    label: row.label,
    status: row.status,
    archivedAt: row.archived_at
  };
}

export function createBillingProfile(db: DatabaseSync, profile: BillingProfile): BillingProfile {
  db.prepare(
    `INSERT INTO cockpit_billing_profiles
    (billing_profile_id, entity_id, project_id, label, status, archived_at)
    VALUES (?, ?, ?, ?, ?, ?)`
  ).run(profile.billingProfileId, profile.entityId, profile.projectId, profile.label, profile.status, profile.archivedAt);
  return profile;
}

export function getBillingProfileById(db: DatabaseSync, billingProfileId: string): BillingProfile | null {
  const row = one<BillingProfileRow>(
    db,
    `SELECT billing_profile_id, entity_id, project_id, label, status, archived_at
     FROM cockpit_billing_profiles
     WHERE billing_profile_id = ?`,
    billingProfileId
  );
  return row ? toBillingProfile(row) : null;
}

export function listBillingProfilesByProjectId(db: DatabaseSync, projectId: string, includeArchived: boolean): BillingProfile[] {
  const sql = includeArchived
    ? `SELECT billing_profile_id, entity_id, project_id, label, status, archived_at
       FROM cockpit_billing_profiles
       WHERE project_id = ?
       ORDER BY billing_profile_id ASC`
    : `SELECT billing_profile_id, entity_id, project_id, label, status, archived_at
       FROM cockpit_billing_profiles
       WHERE project_id = ? AND archived_at IS NULL
       ORDER BY billing_profile_id ASC`;
  return all<BillingProfileRow>(db, sql, projectId).map(toBillingProfile);
}

export function findActiveBillingProfileByLabel(db: DatabaseSync, projectId: string, label: string): BillingProfile | null {
  const row = one<BillingProfileRow>(
    db,
    `SELECT billing_profile_id, entity_id, project_id, label, status, archived_at
     FROM cockpit_billing_profiles
     WHERE project_id = ? AND label = ? AND archived_at IS NULL`,
    projectId,
    label
  );
  return row ? toBillingProfile(row) : null;
}

export function updateBillingProfile(db: DatabaseSync, profile: BillingProfile): BillingProfile {
  db.prepare(
    `UPDATE cockpit_billing_profiles
     SET status = ?, archived_at = ?
     WHERE billing_profile_id = ?`
  ).run(profile.status, profile.archivedAt, profile.billingProfileId);
  return profile;
}
