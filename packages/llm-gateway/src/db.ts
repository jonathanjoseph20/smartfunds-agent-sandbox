import { createRequire } from "node:module";
import { dayRange, monthRange, type AuditLogEntry, type AuditSpendSnapshot, type AuditStore } from "./audit.js";
import type { LlmRouteClass } from "./types.js";

const require = createRequire(import.meta.url);

type NodeSqliteModule = typeof import("node:sqlite");

type DatabaseSyncInstance = InstanceType<NodeSqliteModule["DatabaseSync"]>;

function loadNodeSqlite(): NodeSqliteModule {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-return
  return require("node:sqlite");
}

const DEFAULT_AUDIT_DB_PATH = ".smartfunds/llm-audit.sqlite";

const sqliteAuditRegistry = new Map<string, SqliteAuditStore>();

export function getSqliteAuditStore(dbPath = process.env.LLM_AUDIT_DB_PATH ?? DEFAULT_AUDIT_DB_PATH): AuditStore {
  const existing = sqliteAuditRegistry.get(dbPath);
  if (existing) {
    return existing;
  }

  const { DatabaseSync } = loadNodeSqlite();
  const db = new DatabaseSync(dbPath);
  const store = new SqliteAuditStore(db);
  sqliteAuditRegistry.set(dbPath, store);
  return store;
}

export class SqliteAuditStore implements AuditStore {
  private readonly db: DatabaseSyncInstance;

  constructor(db: DatabaseSyncInstance) {
    this.db = db;
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS llm_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        caller_class TEXT NOT NULL,
        route_class TEXT NOT NULL,
        provider TEXT NOT NULL,
        model_alias TEXT NOT NULL,
        provider_model TEXT NOT NULL,
        prompt_id TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        status TEXT NOT NULL,
        fallback_used INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER,
        output_tokens INTEGER,
        estimated_cost_usd REAL,
        latency_ms INTEGER,
        error_code TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  write(entry: AuditLogEntry): void {
    this.db.prepare(`
      INSERT INTO llm_audit_log (
        request_id,
        caller_class,
        route_class,
        provider,
        model_alias,
        provider_model,
        prompt_id,
        prompt_version,
        status,
        fallback_used,
        input_tokens,
        output_tokens,
        estimated_cost_usd,
        latency_ms,
        error_code,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.requestId,
      entry.callerClass,
      entry.routeClass,
      entry.provider,
      entry.modelAlias,
      entry.providerModel,
      entry.promptId,
      entry.promptVersion,
      entry.status,
      entry.fallbackUsed ? 1 : 0,
      entry.inputTokens ?? null,
      entry.outputTokens ?? null,
      entry.estimatedCostUsd ?? null,
      entry.latencyMs ?? null,
      entry.errorCode ?? null,
      entry.createdAt
    );
  }

  getSpendSnapshot(routeClass: LlmRouteClass, nowIso: string): AuditSpendSnapshot {
    const daily = dayRange(nowIso);
    const monthly = monthRange(nowIso);

    const dailyRow = this.db.prepare(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
         FROM llm_audit_log
        WHERE created_at >= ? AND created_at < ?`
    ).get(daily.start, daily.end) as { total?: number };

    const monthlyRow = this.db.prepare(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
         FROM llm_audit_log
        WHERE created_at >= ? AND created_at < ?`
    ).get(monthly.start, monthly.end) as { total?: number };

    const routeDailyRow = this.db.prepare(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
         FROM llm_audit_log
        WHERE route_class = ? AND created_at >= ? AND created_at < ?`
    ).get(routeClass, daily.start, daily.end) as { total?: number };

    return {
      globalDailySpentUsd: Number(dailyRow.total ?? 0),
      globalMonthlySpentUsd: Number(monthlyRow.total ?? 0),
      routeDailySpentUsd: Number(routeDailyRow.total ?? 0)
    };
  }

  listEntries(): AuditLogEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM llm_audit_log ORDER BY created_at ASC, id ASC")
      .all() as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      requestId: String(row.request_id),
      callerClass: String(row.caller_class),
      routeClass: row.route_class as LlmRouteClass,
      provider: String(row.provider),
      modelAlias: String(row.model_alias),
      providerModel: String(row.provider_model),
      promptId: String(row.prompt_id),
      promptVersion: String(row.prompt_version),
      status: row.status === "success" ? "success" : "error",
      fallbackUsed: Number(row.fallback_used) === 1,
      inputTokens: row.input_tokens === null ? undefined : Number(row.input_tokens),
      outputTokens: row.output_tokens === null ? undefined : Number(row.output_tokens),
      estimatedCostUsd: row.estimated_cost_usd === null ? undefined : Number(row.estimated_cost_usd),
      latencyMs: row.latency_ms === null ? undefined : Number(row.latency_ms),
      errorCode: row.error_code === null ? undefined : String(row.error_code),
      createdAt: String(row.created_at)
    }));
  }
}
