import { describe, expect, test, beforeEach } from "vitest";
import { createFakeDb } from "../src/testkit/fakeDb";
import { storeFromDbLike } from "../src/store";
import { createFakeDb } from "../src/testkit/fakeDb";
import { storeFromDbLike } from "../src/store";
import { MissionStatus } from "@smartfunds/shared";
import {
  InvalidTransitionError,
  createMission,
  getDb,
  getMission,
  getMissionAuditLog,
  transitionMission
} from "../src/index.js";

const DB_PATH = ":memory:";
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => {
  const fakeDb = createFakeDb();
  const store = storeFromDbLike(fakeDb);
  store.clearAll();
});

describe("mission engine", () => {
  test("T-M1 createMission returns mission with UUID, INTAKE, 506C and ISO timestamps", () => {
    const mission = createMission(
      {
        offering_name: "Growth Fund 1",
        asset_type: "Equity",
        target_raise: 1000000,
        jurisdiction: "US",
        actor: "operator@smartfunds"
      },
      DB_PATH
    );

    expect(mission.id).toMatch(UUID_REGEX);
    expect(mission.status).toBe(MissionStatus.INTAKE);
    expect(mission.exemption_type).toBe("506C");
    expect(mission.created_at).toMatch(ISO_REGEX);
    expect(mission.updated_at).toMatch(ISO_REGEX);
  });

  test("T-M2 INTAKE -> IMPLEMENTATION skip throws InvalidTransitionError", () => {
    const mission = createMission(
      {
        offering_name: "Growth Fund 2",
        asset_type: "Debt",
        target_raise: 250000,
        jurisdiction: "US",
        actor: "operator@smartfunds"
      },
      DB_PATH
    );

    expect(() => {
      transitionMission(
        {
          mission_id: mission.id,
          to_status: MissionStatus.IMPLEMENTATION,
          actor: "reviewer@smartfunds"
        },
        DB_PATH
      );
    }).toThrowError(InvalidTransitionError);
  });

  test("T-M3 walks through all valid transitions and rejection loops", () => {
    const mission = createMission(
      {
        offering_name: "Growth Fund 3",
        asset_type: "Real Estate",
        target_raise: 500000,
        jurisdiction: "US",
        actor: "operator@smartfunds"
      },
      DB_PATH
    );

    const flow: MissionStatus[] = [
      MissionStatus.LEGAL_STRUCTURING,
      MissionStatus.COMPOSITION,
      MissionStatus.IMPLEMENTATION,
      MissionStatus.PR_GATE,
      MissionStatus.VERIFICATION,
      MissionStatus.HUMAN_CHECKPOINT,
      MissionStatus.APPROVED,
      MissionStatus.LAUNCHED,
      MissionStatus.ARCHIVED
    ];

    let current = mission;
    for (const nextStatus of flow) {
      current = transitionMission(
        {
          mission_id: mission.id,
          to_status: nextStatus,
          actor: "operator@smartfunds"
        },
        DB_PATH
      );
      expect(current.status).toBe(nextStatus);
    }

    const missionWithVerificationLoop = createMission(
      {
        offering_name: "Growth Fund 4",
        asset_type: "Equity",
        target_raise: 200000,
        jurisdiction: "US",
        actor: "operator@smartfunds"
      },
      DB_PATH
    );

    for (const nextStatus of [
      MissionStatus.LEGAL_STRUCTURING,
      MissionStatus.COMPOSITION,
      MissionStatus.IMPLEMENTATION,
      MissionStatus.PR_GATE,
      MissionStatus.VERIFICATION,
      MissionStatus.IMPLEMENTATION
    ]) {
      transitionMission(
        { mission_id: missionWithVerificationLoop.id, to_status: nextStatus, actor: "operator@smartfunds" },
        DB_PATH
      );
    }

    const missionWithHumanLoop = createMission(
      {
        offering_name: "Growth Fund 5",
        asset_type: "Equity",
        target_raise: 200000,
        jurisdiction: "US",
        actor: "operator@smartfunds"
      },
      DB_PATH
    );

    for (const nextStatus of [
      MissionStatus.LEGAL_STRUCTURING,
      MissionStatus.COMPOSITION,
      MissionStatus.IMPLEMENTATION,
      MissionStatus.PR_GATE,
      MissionStatus.VERIFICATION,
      MissionStatus.HUMAN_CHECKPOINT,
      MissionStatus.IMPLEMENTATION
    ]) {
      transitionMission(
        { mission_id: missionWithHumanLoop.id, to_status: nextStatus, actor: "operator@smartfunds" },
        DB_PATH
      );
    }
  });

  test("T-M4 audit log captures creation and transitions in deterministic order", () => {
    const mission = createMission(
      {
        offering_name: "Growth Fund 6",
        asset_type: "Equity",
        target_raise: 100000,
        jurisdiction: "US",
        actor: "creator@smartfunds"
      },
      DB_PATH
    );

    transitionMission(
      {
        mission_id: mission.id,
        to_status: MissionStatus.LEGAL_STRUCTURING,
        actor: "legal@smartfunds"
      },
      DB_PATH
    );

    transitionMission(
      {
        mission_id: mission.id,
        to_status: MissionStatus.COMPOSITION,
        actor: "composition@smartfunds",
        metadata: { note: "ready" }
      },
      DB_PATH
    );

    const auditLog = getMissionAuditLog(mission.id, DB_PATH);
    expect(auditLog).toHaveLength(3);
    expect(auditLog[0]).toMatchObject({ from_status: null, to_status: MissionStatus.INTAKE, actor: "creator@smartfunds" });
    expect(auditLog[1]).toMatchObject({
      from_status: MissionStatus.INTAKE,
      to_status: MissionStatus.LEGAL_STRUCTURING,
      actor: "legal@smartfunds"
    });
    expect(auditLog[2]).toMatchObject({
      from_status: MissionStatus.LEGAL_STRUCTURING,
      to_status: MissionStatus.COMPOSITION,
      actor: "composition@smartfunds"
    });
    expect(auditLog[2].metadata).toEqual({ note: "ready" });

    for (const entry of auditLog) {
      expect(entry.timestamp).toMatch(ISO_REGEX);
    }

    const orderedTimestamps = [...auditLog].map((entry) => entry.timestamp);
    expect(orderedTimestamps).toEqual([...orderedTimestamps].sort());
  });

  test("getMission(nonexistent) returns null", () => {
    expect(getMission("missing-id", DB_PATH)).toBeNull();
  });

  test("createMission with missing required field throws", () => {
    expect(() => {
      createMission(
        {
          offering_name: "",
          asset_type: "Equity",
          target_raise: 100,
          jurisdiction: "US",
          actor: "operator"
        },
        DB_PATH
      );
    }).toThrowError("offering_name is required");
  });
});
