import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { assembleDocuments } from "../src/assembler.js";
import { seedDefaultTemplates } from "../src/registry.js";
import { getSqliteDocFactoryStore } from "../src/store.js";

const runSqlite = process.env.RUN_SQLITE_INTEGRATION === "1";

const maybeDescribe = runSqlite ? describe : describe.skip;

maybeDescribe("doc-factory sqlite integration", () => {
  test("persists and assembles using sqlite store", () => {
    const dbPath = `/tmp/smartfunds-doc-factory-${randomUUID()}.db`;

    try {
      const store = getSqliteDocFactoryStore(dbPath);
      seedDefaultTemplates(store, "2026-01-01T00:00:00.000Z");

      const result = assembleDocuments({
        store,
        mission_id: "mission-integration",
        module_template_id: "generic_spv_module",
        deal_inputs: {
          offering_name: "Fund A",
          issuer_name: "Issuer",
          target_raise: 123,
          jurisdiction: "US",
          minimum_investment: 10,
          offering_period: "30 days",
          asset_description: "Asset",
          asset_valuation: "500000"
        },
        created_at: "2026-01-01T00:00:00.000Z"
      });

      expect(result.document_set).toHaveLength(4);
    } finally {
      rmSync(dbPath, { force: true });
    }
  });
});
