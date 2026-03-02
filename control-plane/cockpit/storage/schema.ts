import type { DatabaseSync } from 'node:sqlite';

const COCKPIT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS cockpit_id_counters (
    prefix TEXT PRIMARY KEY,
    next_value INTEGER NOT NULL CHECK(next_value >= 1)
  );

  CREATE TABLE IF NOT EXISTS cockpit_idempotency (
    scope TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    PRIMARY KEY(scope, idempotency_key)
  );

  CREATE TABLE IF NOT EXISTS cockpit_entities (
    entity_id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cockpit_projects (
    project_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    name TEXT NOT NULL,
    archived_at TEXT,
    default_billing_profile_id TEXT,
    FOREIGN KEY(entity_id) REFERENCES cockpit_entities(entity_id),
    FOREIGN KEY(default_billing_profile_id) REFERENCES cockpit_billing_profiles(billing_profile_id)
  );

  CREATE TABLE IF NOT EXISTS cockpit_teams (
    team_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    archived_at TEXT,
    FOREIGN KEY(project_id) REFERENCES cockpit_projects(project_id)
  );

  CREATE TABLE IF NOT EXISTS cockpit_roles (
    role_id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    name TEXT NOT NULL,
    assignee_ref TEXT,
    archived_at TEXT,
    FOREIGN KEY(team_id) REFERENCES cockpit_teams(team_id)
  );

  CREATE TABLE IF NOT EXISTS cockpit_goals (
    goal_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    title TEXT NOT NULL,
    goal_type TEXT NOT NULL,
    spec_ref TEXT,
    spec_json TEXT,
    archived_at TEXT,
    FOREIGN KEY(project_id) REFERENCES cockpit_projects(project_id),
    FOREIGN KEY(team_id) REFERENCES cockpit_teams(team_id)
  );

  CREATE TABLE IF NOT EXISTS cockpit_runs (
    run_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    goal_id TEXT NOT NULL,
    run_index INTEGER NOT NULL,
    status TEXT NOT NULL,
    idempotency_key TEXT,
    FOREIGN KEY(project_id) REFERENCES cockpit_projects(project_id),
    FOREIGN KEY(goal_id) REFERENCES cockpit_goals(goal_id),
    UNIQUE(goal_id, run_index)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS cockpit_runs_goal_idempotency_idx
  ON cockpit_runs(goal_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

  CREATE TABLE IF NOT EXISTS cockpit_run_attempts (
    run_id TEXT NOT NULL,
    attempt_index INTEGER NOT NULL,
    status TEXT NOT NULL,
    idempotency_key TEXT,
    PRIMARY KEY(run_id, attempt_index),
    FOREIGN KEY(run_id) REFERENCES cockpit_runs(run_id)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS cockpit_attempts_run_idempotency_idx
  ON cockpit_run_attempts(run_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

  CREATE TABLE IF NOT EXISTS cockpit_run_events (
    run_id TEXT NOT NULL,
    attempt_index INTEGER NOT NULL,
    event_seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    payload_json TEXT,
    envelope_hash TEXT,
    PRIMARY KEY(run_id, attempt_index, event_seq),
    FOREIGN KEY(run_id, attempt_index) REFERENCES cockpit_run_attempts(run_id, attempt_index)
  );

  CREATE TABLE IF NOT EXISTS cockpit_approval_requests (
    approval_request_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    attempt_index INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    action_payload_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'denied', 'expired')),
    requested_by_ref TEXT,
    reviewed_by_ref TEXT,
    decision_reason TEXT,
    idempotency_key TEXT,
    FOREIGN KEY(run_id, attempt_index) REFERENCES cockpit_run_attempts(run_id, attempt_index)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS cockpit_approvals_attempt_idempotency_idx
  ON cockpit_approval_requests(run_id, attempt_index, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

  CREATE TABLE IF NOT EXISTS cockpit_pr_artifacts (
    artifact_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    attempt_index INTEGER NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    external_url TEXT,
    external_ref TEXT,
    metadata_json TEXT,
    FOREIGN KEY(run_id, attempt_index) REFERENCES cockpit_run_attempts(run_id, attempt_index)
  );

  CREATE TABLE IF NOT EXISTS cockpit_billing_profiles (
    billing_profile_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'disabled')),
    archived_at TEXT,
    FOREIGN KEY(entity_id) REFERENCES cockpit_entities(entity_id),
    FOREIGN KEY(project_id) REFERENCES cockpit_projects(project_id)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS cockpit_billing_project_label_active_idx
  ON cockpit_billing_profiles(project_id, label)
  WHERE archived_at IS NULL;

  CREATE TABLE IF NOT EXISTS cockpit_rail_bindings (
    rail_binding_id TEXT PRIMARY KEY,
    billing_profile_id TEXT NOT NULL,
    rail_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'disabled')),
    external_ref TEXT,
    metadata_json TEXT,
    FOREIGN KEY(billing_profile_id) REFERENCES cockpit_billing_profiles(billing_profile_id)
  );
`;

export function ensureCockpitSchema(db: DatabaseSync): void {
  db.exec(COCKPIT_SCHEMA_SQL);
}
