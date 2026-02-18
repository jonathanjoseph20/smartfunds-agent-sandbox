import { Hono } from "hono";
import { InvalidTransitionError, MissionNotFoundError, createMission, getMission, getMissionAuditLog, listMissions, transitionMission } from "@smartfunds/mission-engine";
import { MissionStatus } from "@smartfunds/shared";

const app = new Hono();

function isMissionStatus(value: string): value is MissionStatus {
  return Object.values(MissionStatus).includes(value as MissionStatus);
}

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/missions", async (c) => {
  const body = await c.req.json();
  try {
    const mission = createMission(body as {
      offering_name: string;
      asset_type: string;
      target_raise: number;
      jurisdiction: string;
      actor: string;
    });
    return c.json(mission, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

app.get("/missions", (c) => c.json(listMissions(), 200));

app.get("/missions/:id", (c) => {
  const mission = getMission(c.req.param("id"));
  if (!mission) {
    return c.json({ error: "Mission not found" }, 404);
  }
  return c.json(mission, 200);
});

app.post("/missions/:id/transition", async (c) => {
  const missionId = c.req.param("id");
  const body = await c.req.json();
  const toStatus = (body as { to_status?: string }).to_status;

  if (typeof toStatus !== "string" || !isMissionStatus(toStatus)) {
    return c.json({ error: "Invalid to_status" }, 400);
  }

  try {
    const mission = transitionMission({
      mission_id: missionId,
      to_status: toStatus,
      actor: (body as { actor: string }).actor,
      metadata: (body as { metadata?: Record<string, unknown> }).metadata
    });
    return c.json(mission, 200);
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return c.json(
        {
          error: error.message,
          details: { from: error.from, to: error.to }
        },
        400
      );
    }

    if (error instanceof MissionNotFoundError) {
      return c.json(
        {
          error: error.message,
          details: { mission_id: error.mission_id }
        },
        404
      );
    }

    return c.json({ error: (error as Error).message }, 400);
  }
});

app.get("/missions/:id/audit", (c) => {
  try {
    const audit = getMissionAuditLog(c.req.param("id"));
    return c.json(audit, 200);
  } catch (error) {
    if (error instanceof MissionNotFoundError) {
      return c.json(
        {
          error: error.message,
          details: { mission_id: error.mission_id }
        },
        404
      );
    }

    return c.json({ error: (error as Error).message }, 400);
  }
});

export default app;
