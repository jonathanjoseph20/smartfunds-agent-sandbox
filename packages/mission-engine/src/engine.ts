import { randomUUID } from "node:crypto";
import { AuditLogEntry, ExemptionType, Mission, MissionStatus } from "@smartfunds/shared";
import { getDb } from "./db.js";
import { InvalidTransitionError, MissionNotFoundError } from "./errors.js";
import { isValidTransition } from "./transitions.js";

let lastTimestampMs = 0;

function getIsoTimestamp(): string {
  const now = Date.now();
  lastTimestampMs = now > lastTimestampMs ? now : lastTimestampMs + 1;
  return new Date(lastTimestampMs).toISOString();
}


function assertNonEmptyString(value: string, fieldName: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
}

function assertTargetRaise(value: number): void {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new Error("target_raise must be a number greater than 0");
  }
}

function toMission(row: Record<string, unknown>): Mission {
  return {
    id: row.id as string,
    offering_name: row.offering_name as string,
    asset_type: row.asset_type as string,
    exemption_type: row.exemption_type as ExemptionType,
    target_raise: Number(row.target_raise),
    jurisdiction: row.jurisdiction as string,
    status: row.status as MissionStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  };
}

function toAuditLogEntry(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row.id as string,
    mission_id: row.mission_id as string,
    from_status: (row.from_status as MissionStatus | null) ?? null,
    to_status: row.to_status as MissionStatus,
    actor: row.actor as string,
    timestamp: row.timestamp as string,
    metadata: row.metadata ? (JSON.parse(row.metadata as string) as Record<string, unknown>) : null
  };
}

export function createMission(
  input: {
    offering_name: string;
    asset_type: string;
    target_raise: number;
    jurisdiction: string;
    actor: string;
  },
  dbPath?: string
): Mission {
  assertNonEmptyString(input.offering_name, "offering_name");
  assertNonEmptyString(input.asset_type, "asset_type");
  assertTargetRaise(input.target_raise);
  assertNonEmptyString(input.jurisdiction, "jurisdiction");
  assertNonEmptyString(input.actor, "actor");

  const db = getDb(dbPath);
  const timestamp = getIsoTimestamp();
  const mission: Mission = {
    id: randomUUID(),
    offering_name: input.offering_name,
    asset_type: input.asset_type,
    exemption_type: ExemptionType.C506,
    target_raise: input.target_raise,
    jurisdiction: input.jurisdiction,
    status: MissionStatus.INTAKE,
    created_at: timestamp,
    updated_at: timestamp
  };

  const insertMissionStmt = db.prepare(`
    INSERT INTO missions (id, offering_name, asset_type, exemption_type, target_raise, jurisdiction, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMissionStmt.run(
    mission.id,
    mission.offering_name,
    mission.asset_type,
    mission.exemption_type,
    mission.target_raise,
    mission.jurisdiction,
    mission.status,
    mission.created_at,
    mission.updated_at
  );

  const insertAuditStmt = db.prepare(`
    INSERT INTO audit_log (id, mission_id, from_status, to_status, actor, timestamp, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAuditStmt.run(randomUUID(), mission.id, null, MissionStatus.INTAKE, input.actor, timestamp, null);

  return mission;
}

export function transitionMission(
  input: {
    mission_id: string;
    to_status: MissionStatus;
    actor: string;
    metadata?: Record<string, unknown>;
  },
  dbPath?: string
): Mission {
  assertNonEmptyString(input.mission_id, "mission_id");
  assertNonEmptyString(input.actor, "actor");

  const db = getDb(dbPath);
  const selectMissionStmt = db.prepare("SELECT * FROM missions WHERE id = ?");
  const currentRow = selectMissionStmt.get(input.mission_id) as Record<string, unknown> | undefined;

  if (!currentRow) {
    throw new MissionNotFoundError(input.mission_id);
  }

  const currentMission = toMission(currentRow);
  if (!isValidTransition(currentMission.status, input.to_status)) {
    throw new InvalidTransitionError(currentMission.status, input.to_status);
  }

  const timestamp = getIsoTimestamp();
  const updateStmt = db.prepare("UPDATE missions SET status = ?, updated_at = ? WHERE id = ?");
  updateStmt.run(input.to_status, timestamp, input.mission_id);

  const insertAuditStmt = db.prepare(`
    INSERT INTO audit_log (id, mission_id, from_status, to_status, actor, timestamp, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAuditStmt.run(
    randomUUID(),
    input.mission_id,
    currentMission.status,
    input.to_status,
    input.actor,
    timestamp,
    input.metadata ? JSON.stringify(input.metadata) : null
  );

  const updatedRow = selectMissionStmt.get(input.mission_id) as Record<string, unknown>;
  return toMission(updatedRow);
}

export function getMission(mission_id: string, dbPath?: string): Mission | null {
  const db = getDb(dbPath);
  const stmt = db.prepare("SELECT * FROM missions WHERE id = ?");
  const row = stmt.get(mission_id) as Record<string, unknown> | undefined;
  return row ? toMission(row) : null;
}

export function listMissions(dbPath?: string): Mission[] {
  const db = getDb(dbPath);
  const stmt = db.prepare("SELECT * FROM missions ORDER BY created_at ASC, id ASC");
  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(toMission);
}

export function getMissionAuditLog(mission_id: string, dbPath?: string): AuditLogEntry[] {
  const mission = getMission(mission_id, dbPath);
  if (!mission) {
    throw new MissionNotFoundError(mission_id);
  }

  const db = getDb(dbPath);
  const stmt = db.prepare("SELECT * FROM audit_log WHERE mission_id = ? ORDER BY timestamp ASC, id ASC");
  const rows = stmt.all(mission_id) as Record<string, unknown>[];
  return rows.map(toAuditLogEntry);
}
