import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createLlmGateway } from "../src/gateway.js";
import { createFakeProvider } from "../src/providers/fake.adapter.js";
import { getSqliteAuditStore } from "../src/db.js";
import { baseTextRequest } from "../src/testing/fixtures.js";

const runIntegration = process.env.RUN_LLM_INTEGRATION === "1" || process.env.RUN_SQLITE_INTEGRATION === "1";

describe("sqlite integration", () => {
  it.skipIf(!runIntegration)("writes and reads llm_audit_log (T-I1)", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smartfunds-llm-gateway-"));
    const dbPath = path.join(tmpDir, `${randomUUID()}.sqlite`);

    try {
      const auditStore = getSqliteAuditStore(dbPath);
      const gateway = createLlmGateway({
        registry: {
          version: 1,
          defaultRouteMap: {
            utility: "fake-default",
            default: "fake-default",
            analysis: "fake-default",
            coding: "fake-default",
            review: "disabled",
            fallback: "fake-fallback",
            mock: "fake-default"
          },
          models: [
            { id: "fake-default", provider: "fake", model: "fake-default", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 },
            { id: "fake-fallback", provider: "fake", model: "fake-fallback", enabled: true, supportsStructured: true, relativeCostTier: 0, qualityTier: 0, latencyTier: 0 }
          ]
        },
        routePolicy: {
          version: 1,
          routes: {
            utility: { enabled: true, allowFallback: true, maxCostTier: 1 },
            default: { enabled: true, allowFallback: true, maxCostTier: 1 },
            analysis: { enabled: true, allowFallback: true, maxCostTier: 1 },
            coding: { enabled: true, allowFallback: true, maxCostTier: 1, allowedCallerClasses: ["operator", "internal_service", "operator_tool"] },
            review: { enabled: false, allowFallback: false, allowedCallerClasses: ["operator", "operator_tool"] },
            fallback: { enabled: true, allowFallback: false },
            mock: { enabled: true, allowFallback: false }
          }
        },
        providers: { fake: createFakeProvider({ textResponse: "sqlite-ok" }) },
        auditStore,
        now: () => new Date("2026-01-03T00:00:00.000Z"),
        requestIdFactory: () => "req-sqlite"
      });

      const result = await gateway.generateText(baseTextRequest());
      expect(result).toMatchObject({ ok: true, text: "sqlite-ok" });

      const rows = auditStore.listEntries?.() ?? [];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        requestId: "req-sqlite",
        routeClass: "default",
        status: "success"
      });
    } finally {
      fs.rmSync(dbPath, { force: true });
    }
  });
});
