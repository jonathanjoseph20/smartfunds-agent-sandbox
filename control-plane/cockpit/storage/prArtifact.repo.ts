import type { DatabaseSync } from 'node:sqlite';

import type { PRArtifact } from '../models/prArtifact.ts';
import { all, one } from './_shared.ts';

interface PRArtifactRow {
  artifact_id: string;
  project_id: string;
  run_id: string;
  attempt_index: number;
  kind: string;
  status: string;
  external_url: string | null;
  external_ref: string | null;
  metadata_json: string | null;
}

function toPRArtifact(row: PRArtifactRow): PRArtifact {
  return {
    artifactId: row.artifact_id,
    projectId: row.project_id,
    runId: row.run_id,
    attemptIndex: row.attempt_index,
    kind: row.kind,
    status: row.status,
    externalUrl: row.external_url,
    externalRef: row.external_ref,
    metadataJson: row.metadata_json
  };
}

export function createPRArtifact(db: DatabaseSync, artifact: PRArtifact): PRArtifact {
  db.prepare(
    `INSERT INTO cockpit_pr_artifacts
    (artifact_id, project_id, run_id, attempt_index, kind, status, external_url, external_ref, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    artifact.artifactId,
    artifact.projectId,
    artifact.runId,
    artifact.attemptIndex,
    artifact.kind,
    artifact.status,
    artifact.externalUrl,
    artifact.externalRef,
    artifact.metadataJson
  );
  return artifact;
}

export function getPRArtifactById(db: DatabaseSync, artifactId: string): PRArtifact | null {
  const row = one<PRArtifactRow>(
    db,
    `SELECT artifact_id, project_id, run_id, attempt_index, kind, status, external_url, external_ref, metadata_json
     FROM cockpit_pr_artifacts WHERE artifact_id = ?`,
    artifactId
  );
  return row ? toPRArtifact(row) : null;
}

export function listPRArtifactsByRun(db: DatabaseSync, runId: string): PRArtifact[] {
  return all<PRArtifactRow>(
    db,
    `SELECT artifact_id, project_id, run_id, attempt_index, kind, status, external_url, external_ref, metadata_json
     FROM cockpit_pr_artifacts
     WHERE run_id = ?
     ORDER BY attempt_index ASC, artifact_id ASC`,
    runId
  ).map(toPRArtifact);
}

export function listPRArtifactsByAttempt(db: DatabaseSync, runId: string, attemptIndex: number): PRArtifact[] {
  return all<PRArtifactRow>(
    db,
    `SELECT artifact_id, project_id, run_id, attempt_index, kind, status, external_url, external_ref, metadata_json
     FROM cockpit_pr_artifacts
     WHERE run_id = ? AND attempt_index = ?
     ORDER BY artifact_id ASC`,
    runId,
    attemptIndex
  ).map(toPRArtifact);
}

export function updatePRArtifact(db: DatabaseSync, artifact: PRArtifact): PRArtifact {
  db.prepare(
    `UPDATE cockpit_pr_artifacts
     SET status = ?, external_url = ?, external_ref = ?, metadata_json = ?
     WHERE artifact_id = ?`
  ).run(artifact.status, artifact.externalUrl, artifact.externalRef, artifact.metadataJson, artifact.artifactId);
  return artifact;
}
