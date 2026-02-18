import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { getDb } from "../src/db";

const shouldRun = process.env.RUN_SQLITE_INTEGRATION === "1";

describe("sqlite integration", () => {
  test.skipIf(!shouldRun)("can create db and required tables", () => {
    // Put the db in a temp directory so it never conflicts with real data
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smartfunds-mission-engine-"));
    const dbPath = path.join(tmpDir, `test-${randomUUID()}.db`);

    const db = getDb(dbPath);

    // Verify tables exist
    const row = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('missions','audit_log') ORDER BY name;`
      )
      .all() as Array<{ name: string }>;

    const names = row.map((r) => r.name);
    expect(names).toContain("audit_log");
    expect(names).toContain("missions");
  });
});
