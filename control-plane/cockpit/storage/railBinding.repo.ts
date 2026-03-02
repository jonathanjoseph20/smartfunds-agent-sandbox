import type { DatabaseSync } from 'node:sqlite';

import type { RailBinding } from '../models/railBinding.ts';
import { all, one } from './_shared.ts';

interface RailBindingRow {
  rail_binding_id: string;
  billing_profile_id: string;
  rail_type: string;
  status: 'active' | 'disabled';
  external_ref: string | null;
  metadata_json: string | null;
}

function toRailBinding(row: RailBindingRow): RailBinding {
  return {
    railBindingId: row.rail_binding_id,
    billingProfileId: row.billing_profile_id,
    railType: row.rail_type,
    status: row.status,
    externalRef: row.external_ref,
    metadataJson: row.metadata_json
  };
}

export function createRailBinding(db: DatabaseSync, railBinding: RailBinding): RailBinding {
  db.prepare(
    `INSERT INTO cockpit_rail_bindings
    (rail_binding_id, billing_profile_id, rail_type, status, external_ref, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    railBinding.railBindingId,
    railBinding.billingProfileId,
    railBinding.railType,
    railBinding.status,
    railBinding.externalRef,
    railBinding.metadataJson
  );
  return railBinding;
}

export function getRailBindingById(db: DatabaseSync, railBindingId: string): RailBinding | null {
  const row = one<RailBindingRow>(
    db,
    `SELECT rail_binding_id, billing_profile_id, rail_type, status, external_ref, metadata_json
     FROM cockpit_rail_bindings
     WHERE rail_binding_id = ?`,
    railBindingId
  );
  return row ? toRailBinding(row) : null;
}

export function listRailBindingsByBillingProfileId(db: DatabaseSync, billingProfileId: string): RailBinding[] {
  return all<RailBindingRow>(
    db,
    `SELECT rail_binding_id, billing_profile_id, rail_type, status, external_ref, metadata_json
     FROM cockpit_rail_bindings
     WHERE billing_profile_id = ?
     ORDER BY rail_binding_id ASC`,
    billingProfileId
  ).map(toRailBinding);
}

export function updateRailBinding(db: DatabaseSync, railBinding: RailBinding): RailBinding {
  db.prepare(
    `UPDATE cockpit_rail_bindings
     SET status = ?, external_ref = ?, metadata_json = ?
     WHERE rail_binding_id = ?`
  ).run(railBinding.status, railBinding.externalRef, railBinding.metadataJson, railBinding.railBindingId);
  return railBinding;
}
