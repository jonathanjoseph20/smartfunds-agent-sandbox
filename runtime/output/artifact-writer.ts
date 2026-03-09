import fs from 'node:fs';
import path from 'node:path';
import { ensureArtifactDirectory } from './artifact-manager.ts';
import { writeCsv } from './csv-writer.ts';
import { writeXlsx } from './xlsx-writer.ts';

export type ArtifactFormat = 'csv' | 'xlsx' | 'artifact' | 'markdown';

export interface DeclaredArtifact {
  artifactId: string;
  format: ArtifactFormat;
}

export interface ArtifactWriteRequest {
  runId: string;
  missionId: string;
  type: 'markdown' | 'json' | 'csv' | 'text';
  filename: string;
  content: string | object;
}

function ensureRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) {
    throw new Error(`ERR_ARTIFACT_PATH: invalid relative path ${value}`);
  }
  return normalized;
}

function ensureArtifactFilename(filename: string): string {
  const normalized = filename.trim();
  if (normalized.length === 0 || normalized.includes('/') || normalized.includes('\\') || normalized.includes('..')) {
    throw new Error(`ERR_ARTIFACT_PATH: invalid filename ${filename}`);
  }
  return normalized;
}

function normalizeStableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeStableValue(entry));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, normalizeStableValue(entryValue)]);
    return Object.fromEntries(entries);
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeStableValue(value), null, 2);
}

function serializeCsvContent(content: string | object): string {
  if (typeof content === 'string') {
    const lines = content
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .filter((line) => line.length > 0)
      .sort((left, right) => left.localeCompare(right));
    return `${lines.join('\n')}\n`;
  }

  const payload = content as {
    rows?: Array<Record<string, unknown>>;
    columns?: string[];
  };

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const columns = Array.isArray(payload.columns) ? payload.columns : undefined;
  return writeCsv({ rows, columns });
}

export function writeArtifact(input: ArtifactWriteRequest): string {
  const directory = ensureArtifactDirectory(input.missionId, input.runId);
  const filename = ensureArtifactFilename(input.filename);
  const filePath = path.join(directory, filename);

  if (input.type === 'markdown') {
    const text = typeof input.content === 'string' ? input.content : stableStringify(input.content);
    fs.writeFileSync(filePath, text, 'utf8');
    return filePath;
  }

  if (input.type === 'json') {
    const jsonValue = typeof input.content === 'string' ? JSON.parse(input.content) : input.content;
    fs.writeFileSync(filePath, `${stableStringify(jsonValue)}\n`, 'utf8');
    return filePath;
  }

  if (input.type === 'csv') {
    fs.writeFileSync(filePath, serializeCsvContent(input.content), 'utf8');
    return filePath;
  }

  const text = typeof input.content === 'string' ? input.content : stableStringify(input.content);
  fs.writeFileSync(filePath, text, 'utf8');
  return filePath;
}

function extensionForFormat(format: ArtifactFormat): string {
  if (format === 'csv') return 'csv';
  if (format === 'xlsx') return 'xlsx';
  if (format === 'markdown') return 'md';
  return 'json';
}

export class ArtifactWriter {
  private readonly baseDir: string;
  private readonly declared = new Map<string, DeclaredArtifact>();

  constructor(baseDir: string, declaredArtifacts: DeclaredArtifact[]) {
    this.baseDir = baseDir;
    for (const artifact of [...declaredArtifacts].sort((left, right) => left.artifactId.localeCompare(right.artifactId))) {
      this.declared.set(artifact.artifactId, artifact);
    }
  }

  resolveArtifactPath(input: {
    missionId: string;
    runId: string;
    artifactId: string;
  }): string {
    const declared = this.declared.get(input.artifactId);
    if (!declared) {
      throw new Error(`ERR_ARTIFACT_UNDECLARED: ${input.artifactId}`);
    }

    const ext = extensionForFormat(declared.format);
    const relative = ensureRelativePath(path.join(input.missionId, input.runId, `${input.artifactId}.${ext}`));
    return path.join(this.baseDir, relative);
  }

  writeCsv(input: {
    missionId: string;
    runId: string;
    artifactId: string;
    rows: Array<Record<string, unknown>>;
    columns?: string[];
  }): string {
    const declared = this.declared.get(input.artifactId);
    if (!declared || declared.format !== 'csv') {
      throw new Error(`ERR_ARTIFACT_UNDECLARED: ${input.artifactId}`);
    }

    const filePath = this.resolveArtifactPath(input);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, writeCsv({ rows: input.rows, columns: input.columns }), 'utf8');
    return filePath;
  }

  writeXlsx(input: {
    missionId: string;
    runId: string;
    artifactId: string;
    sheets: Array<{ name: string; rows: Array<Record<string, unknown>>; columns?: string[]; order?: number }>;
  }): string {
    const declared = this.declared.get(input.artifactId);
    if (!declared || declared.format !== 'xlsx') {
      throw new Error(`ERR_ARTIFACT_UNDECLARED: ${input.artifactId}`);
    }

    const filePath = this.resolveArtifactPath(input);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, writeXlsx({ sheets: input.sheets }));
    return filePath;
  }

  writeArtifact(input: {
    missionId: string;
    runId: string;
    artifactId: string;
    payload: Record<string, unknown>;
  }): string {
    const declared = this.declared.get(input.artifactId);
    if (!declared) {
      throw new Error(`ERR_ARTIFACT_UNDECLARED: ${input.artifactId}`);
    }

    const filePath = this.resolveArtifactPath(input);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(input.payload, null, 2)}\n`, 'utf8');
    return filePath;
  }

  writeMarkdown(input: {
    missionId: string;
    runId: string;
    artifactId: string;
    content: string;
  }): string {
    const declared = this.declared.get(input.artifactId);
    if (!declared || declared.format !== 'markdown') {
      throw new Error(`ERR_ARTIFACT_UNDECLARED: ${input.artifactId}`);
    }

    const filePath = this.resolveArtifactPath(input);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${input.content}\n`, 'utf8');
    return filePath;
  }
}
