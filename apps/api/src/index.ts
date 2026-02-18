import { Hono } from "hono";
import { InvalidTransitionError, MissionNotFoundError, createMission, getMission, getMissionAuditLog, listMissions, transitionMission } from "@smartfunds/mission-engine";
import { MissionStatus } from "@smartfunds/shared";
import {
  MissingDealInputsError,
  assembleDocuments,
  getSqliteDocFactoryStore,
  listTemplates,
  seedDefaultTemplates
} from "@smartfunds/doc-factory";

const app = new Hono();
const docFactoryStore = getSqliteDocFactoryStore();

let templatesSeeded = false;

function ensureTemplatesSeeded(): void {
  if (!templatesSeeded) {
    seedDefaultTemplates(docFactoryStore);
    templatesSeeded = true;
  }
}

function isMissionStatus(value: string): value is MissionStatus {
  return Object.values(MissionStatus).includes(value as MissionStatus);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/templates", (c) => {
  ensureTemplatesSeeded();

  const typeParam = c.req.query("type");
  if (typeParam && typeParam !== "base" && typeParam !== "asset_module") {
    return c.json({ error: "Invalid type filter" }, 400);
  }

  const templates = listTemplates(docFactoryStore, typeParam ? { type: typeParam } : undefined);
  return c.json(templates, 200);
});

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
    return c.json({ error: getErrorMessage(error) }, 400);
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

    return c.json({ error: getErrorMessage(error) }, 400);
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

    return c.json({ error: getErrorMessage(error) }, 400);
  }
});

app.post("/missions/:id/assemble", async (c) => {
  ensureTemplatesSeeded();

  const missionId = c.req.param("id");
  const mission = getMission(missionId);

  if (!mission) {
    return c.json({ error: "Mission not found" }, 404);
  }

  if (mission.status !== MissionStatus.LEGAL_STRUCTURING) {
    return c.json({ error: "Mission must be in LEGAL_STRUCTURING to assemble documents" }, 409);
  }

  const body = await c.req.json();
  const moduleTemplateId = (body as { module_template_id?: string }).module_template_id;
  const dealInputs = (body as { deal_inputs?: Record<string, string | number> }).deal_inputs;

  if (typeof moduleTemplateId !== "string" || moduleTemplateId.trim().length === 0) {
    return c.json({ error: "module_template_id is required" }, 400);
  }

  if (!dealInputs || typeof dealInputs !== "object" || Array.isArray(dealInputs)) {
    return c.json({ error: "deal_inputs is required" }, 400);
  }

  try {
    const result = assembleDocuments({
      store: docFactoryStore,
      mission_id: missionId,
      base_template_id: (body as { base_template_id?: string }).base_template_id,
      base_template_version: (body as { base_template_version?: string }).base_template_version,
      module_template_id: moduleTemplateId,
      module_template_version: (body as { module_template_version?: string }).module_template_version,
      deal_inputs: dealInputs
    });
    return c.json(result, 200);
  } catch (error) {
    if (error instanceof MissingDealInputsError) {
      return c.json({ error: error.message, missing_keys: error.missing_keys }, 400);
    }

    return c.json({ error: getErrorMessage(error) }, 400);
  }
});

export default app;
