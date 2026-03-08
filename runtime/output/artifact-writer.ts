import fs from 'node:fs';
import path from 'node:path';
import { writeCsv } from './csv-writer.ts';
import { writeXlsx } from './xlsx-writer.ts';

export type ArtifactFormat = 'csv' | 'xlsx' | 'artifact';

export interface DeclaredArtifact {
  artifactId: string;
  format: ArtifactFormat;
}

function ensureRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) {
    throw new Error(`ERR_ARTIFACT_PATH: invalid relative path ${value}`);
  }
  return normalized;
}

function extensionForFormat(format: ArtifactFormat): string {
  if (format === 'csv') return 'csv';
  if (format === 'xlsx') return 'xlsx';
  return 'json';
}

export class ArtifactWriter {
  private readonly declared = new Map<string, DeclaredArtifact>();

  constructor(
    private readonly baseDir: string,
    declaredArtifacts: DeclaredArtifact[]
  ) {
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
    sheets: Array<{ name: string; rows: Array<Record<string, unknown>>; columns?: string[] }>;
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
}
