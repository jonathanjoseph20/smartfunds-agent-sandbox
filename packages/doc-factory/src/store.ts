import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type NodeSqliteModule = typeof import("node:sqlite");
type DatabaseSyncInstance = InstanceType<NodeSqliteModule["DatabaseSync"]>;

function loadNodeSqlite(): NodeSqliteModule {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-var-requires
  return require("node:sqlite") as NodeSqliteModule;
}

export type TemplateType = "base" | "asset_module";

export interface TemplateRecord {
  id: string;
  version: string;
  name: string;
  type: TemplateType;
  exemption_type: "506C";
  placeholders: string[];
  template_body: string;
  content_hash: string;
  created_at: string;
}

export interface MissionArtifactRecord {
  id: string;
  mission_id: string;
  artifact_type: string;
  artifact_data: string;
  content_hash: string;
  created_at: string;
}

export interface DocFactoryStore {
  upsertTemplate(template: TemplateRecord): void;
  getTemplate(id: string, version: string): TemplateRecord | null;
  listTemplateVersions(id: string): TemplateRecord[];
  listTemplates(): TemplateRecord[];
  insertMissionArtifact(artifact: MissionArtifactRecord): void;
  listMissionArtifacts(mission_id: string, artifact_type: string): MissionArtifactRecord[];
}

export function createFakeDocFactoryStore(): DocFactoryStore {
  const templates = new Map<string, TemplateRecord>();
  const artifacts = new Map<string, MissionArtifactRecord>();

  return {
    upsertTemplate(template) {
      templates.set(`${template.id}::${template.version}`, { ...template, placeholders: [...template.placeholders] });
    },
    getTemplate(id, version) {
      const found = templates.get(`${id}::${version}`);
      return found ? { ...found, placeholders: [...found.placeholders] } : null;
    },
    listTemplateVersions(id) {
      return [...templates.values()]
        .filter((template) => template.id === id)
        .map((template) => ({ ...template, placeholders: [...template.placeholders] }));
    },
    listTemplates() {
      return [...templates.values()].map((template) => ({ ...template, placeholders: [...template.placeholders] }));
    },
    insertMissionArtifact(artifact) {
      artifacts.set(artifact.id, { ...artifact });
    },
    listMissionArtifacts(mission_id, artifact_type) {
      return [...artifacts.values()]
        .filter((artifact) => artifact.mission_id === mission_id && artifact.artifact_type === artifact_type)
        .map((artifact) => ({ ...artifact }));
    }
  };
}

const DEFAULT_DB_PATH = "./smartfunds.db";
const sqliteStoreRegistry = new Map<string, DocFactoryStore>();

export function getSqliteDocFactoryStore(dbPath?: string): DocFactoryStore {
  const resolvedPath = dbPath ?? process.env.SMARTFUNDS_DB_PATH ?? DEFAULT_DB_PATH;
  const existing = sqliteStoreRegistry.get(resolvedPath);

  if (existing) {
    return existing;
  }

  const { DatabaseSync } = loadNodeSqlite();
  const db = new DatabaseSync(resolvedPath);
  const store = createSqliteDocFactoryStore(db);
  sqliteStoreRegistry.set(resolvedPath, store);
  return store;
}

export function createSqliteDocFactoryStore(db: DatabaseSyncInstance): DocFactoryStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates(
      id TEXT NOT NULL,
      version TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('base','asset_module')),
      exemption_type TEXT NOT NULL CHECK(exemption_type='506C'),
      placeholders TEXT NOT NULL,
      template_body TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (id, version)
    );

    CREATE TABLE IF NOT EXISTS mission_artifacts(
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      artifact_data TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return {
    upsertTemplate(template) {
      db.prepare(`
        INSERT INTO templates (id, version, name, type, exemption_type, placeholders, template_body, content_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id, version) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          exemption_type = excluded.exemption_type,
          placeholders = excluded.placeholders,
          template_body = excluded.template_body,
          content_hash = excluded.content_hash,
          created_at = excluded.created_at
      `).run(
        template.id,
        template.version,
        template.name,
        template.type,
        template.exemption_type,
        JSON.stringify(template.placeholders),
        template.template_body,
        template.content_hash,
        template.created_at
      );
    },
    getTemplate(id, version) {
      const row = db.prepare("SELECT * FROM templates WHERE id = ? AND version = ?").get(id, version) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToTemplate(row) : null;
    },
    listTemplateVersions(id) {
      const rows = db.prepare("SELECT * FROM templates WHERE id = ?").all(id) as Record<string, unknown>[];
      return rows.map(rowToTemplate);
    },
    listTemplates() {
      const rows = db.prepare("SELECT * FROM templates").all() as Record<string, unknown>[];
      return rows.map(rowToTemplate);
    },
    insertMissionArtifact(artifact) {
      db.prepare(`
        INSERT INTO mission_artifacts (id, mission_id, artifact_type, artifact_data, content_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        artifact.id,
        artifact.mission_id,
        artifact.artifact_type,
        artifact.artifact_data,
        artifact.content_hash,
        artifact.created_at
      );
    },
    listMissionArtifacts(mission_id, artifact_type) {
      const rows = db
        .prepare("SELECT * FROM mission_artifacts WHERE mission_id = ? AND artifact_type = ? ORDER BY created_at ASC, id ASC")
        .all(mission_id, artifact_type) as Record<string, unknown>[];
      return rows.map(rowToArtifact);
    }
  };
}

function rowToTemplate(row: Record<string, unknown>): TemplateRecord {
  return {
    id: row.id as string,
    version: row.version as string,
    name: row.name as string,
    type: row.type as TemplateType,
    exemption_type: row.exemption_type as "506C",
    placeholders: JSON.parse(row.placeholders as string) as string[],
    template_body: row.template_body as string,
    content_hash: row.content_hash as string,
    created_at: row.created_at as string
  };
}

function rowToArtifact(row: Record<string, unknown>): MissionArtifactRecord {
  return {
    id: row.id as string,
    mission_id: row.mission_id as string,
    artifact_type: row.artifact_type as string,
    artifact_data: row.artifact_data as string,
    content_hash: row.content_hash as string,
    created_at: row.created_at as string
  };
}

export function buildMissionArtifact(
  mission_id: string,
  artifact_type: string,
  artifact_data: string,
  content_hash: string,
  created_at: string
): MissionArtifactRecord {
  return {
    id: randomUUID(),
    mission_id,
    artifact_type,
    artifact_data,
    content_hash,
    created_at
  };
}
