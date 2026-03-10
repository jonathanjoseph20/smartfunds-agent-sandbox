import fs from 'node:fs';
import path from 'node:path';

import {
  ArtifactLoaderError,
  type ArtifactPreviewKind,
  type ArtifactPreviewResponse,
  type ArtifactSummary,
  type RunDetails,
  type RunSummary
} from './types.ts';

const DEFAULT_ARTIFACTS_ROOT = path.join('.', 'artifacts');

interface RunLocation {
  runId: string;
  missionId?: string;
  runDirectory: string;
}

function isSafePathPart(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0
    && !trimmed.includes('..')
    && !trimmed.includes('/')
    && !trimmed.includes('\\')
    && !path.isAbsolute(trimmed);
}

function getPreviewKind(fileName: string): ArtifactPreviewKind {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.md' || ext === '.markdown') {
    return 'markdown';
  }
  if (ext === '.csv') {
    return 'csv';
  }
  if (ext === '.json') {
    return 'json';
  }
  if (ext === '.txt' || ext === '.log' || ext === '.text') {
    return 'text';
  }
  return 'unsupported';
}

function isLikelyText(buffer: Buffer): boolean {
  for (const byte of buffer) {
    if (byte === 0) {
      return false;
    }
  }
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderMarkdown(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, '\n').trim();
  if (normalized.length === 0) {
    return '<p></p>';
  }

  const lines = normalized.split('\n');
  const output: string[] = [];

  for (const line of lines) {
    if (line.startsWith('### ')) {
      output.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      output.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      output.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('- ')) {
      output.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    output.push(`<p>${escapeHtml(line)}</p>`);
  }

  const grouped: string[] = [];
  let inList = false;
  for (const chunk of output) {
    if (chunk.startsWith('<li>')) {
      if (!inList) {
        grouped.push('<ul>');
        inList = true;
      }
      grouped.push(chunk);
      continue;
    }
    if (inList) {
      grouped.push('</ul>');
      inList = false;
    }
    grouped.push(chunk);
  }
  if (inList) {
    grouped.push('</ul>');
  }

  return grouped.join('\n');
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let index = 0;
  let inQuotes = false;

  while (index < line.length) {
    const char = line[index] ?? '';

    if (char === '"') {
      const next = line[index + 1] ?? '';
      if (inQuotes && next === '"') {
        current += '"';
        index += 2;
        continue;
      }
      inQuotes = !inQuotes;
      index += 1;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  cells.push(current);
  return cells;
}

function parseCsv(content: string): { headers: string[]; rows: string[][] } {
  const lines = content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0] ?? '');
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
}

function maybeExtractMetadata(runDirectory: string): {
  workflowId?: string;
  status?: string;
  profile?: string;
  executionPath?: string;
  artifactCount?: number;
  nodes?: string[];
} {
  const metadataFileNames = ['run-metadata.json', 'run.json', 'metadata.json', 'summary.json'];

  for (const fileName of metadataFileNames) {
    const absolute = path.join(runDirectory, fileName);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      continue;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8')) as Record<string, unknown>;
      const workflowId = typeof parsed.workflowId === 'string' ? parsed.workflowId : undefined;
      const status = typeof parsed.status === 'string' ? parsed.status : undefined;
      const profile = typeof parsed.profile === 'string' ? parsed.profile : undefined;
      const executionPath = typeof parsed.executionPath === 'string' ? parsed.executionPath : undefined;
      const artifactCount = typeof parsed.artifactCount === 'number' ? parsed.artifactCount : undefined;
      const nodes = Array.isArray(parsed.nodes) && parsed.nodes.every((entry) => typeof entry === 'string')
        ? parsed.nodes as string[]
        : undefined;
      return { workflowId, status, profile, executionPath, artifactCount, nodes };
    } catch {
      continue;
    }
  }

  return {};
}

function listArtifacts(runDirectory: string): ArtifactSummary[] {
  if (!fs.existsSync(runDirectory)) {
    return [];
  }

  return fs.readdirSync(runDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolute = path.join(runDirectory, entry.name);
      const stat = fs.statSync(absolute);
      return {
        fileName: entry.name,
        previewKind: getPreviewKind(entry.name),
        sizeBytes: stat.size
      };
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

export class ArtifactLoader {
  private readonly artifactsRoot: string;

  constructor(artifactsRoot: string = DEFAULT_ARTIFACTS_ROOT) {
    this.artifactsRoot = artifactsRoot;
  }

  listRuns(): RunSummary[] {
    const locations = this.discoverRunLocations();
    return locations.map((location) => {
      const metadata = maybeExtractMetadata(location.runDirectory);
      return {
        runId: location.runId,
        ...(location.missionId ? { missionId: location.missionId } : {}),
        ...(metadata.status ? { status: metadata.status } : {}),
        ...(metadata.profile ? { profile: metadata.profile } : {}),
        ...(metadata.executionPath ? { executionPath: metadata.executionPath } : {}),
        ...(typeof metadata.artifactCount === 'number' ? { artifactCount: metadata.artifactCount } : {})
      };
    });
  }

  getRunDetails(runId: string): RunDetails {
    const runDirectory = this.resolveRunDirectory(runId);
    if (!runDirectory) {
      throw new ArtifactLoaderError('RUN_NOT_FOUND', 'Run not found');
    }

    const metadata = maybeExtractMetadata(runDirectory.runDirectory);

    return {
      runId: runDirectory.runId,
      ...(runDirectory.missionId ? { missionId: runDirectory.missionId } : {}),
      ...(metadata.workflowId ? { workflowId: metadata.workflowId } : {}),
      ...(metadata.status ? { status: metadata.status } : {}),
      ...(metadata.profile ? { profile: metadata.profile } : {}),
      ...(metadata.executionPath ? { executionPath: metadata.executionPath } : {}),
      ...(typeof metadata.artifactCount === 'number' ? { artifactCount: metadata.artifactCount } : {}),
      ...(metadata.nodes ? { nodes: metadata.nodes } : {}),
      artifacts: listArtifacts(runDirectory.runDirectory)
    };
  }

  getArtifactPreview(runId: string, fileName: string): ArtifactPreviewResponse {
    const runDirectory = this.resolveRunDirectory(runId);
    if (!runDirectory) {
      throw new ArtifactLoaderError('RUN_NOT_FOUND', 'Run not found');
    }

    if (!isSafePathPart(fileName)) {
      throw new ArtifactLoaderError('INVALID_ARTIFACT_PATH', 'Invalid artifact path');
    }

    const artifactPath = path.resolve(runDirectory.runDirectory, fileName);
    const runDirResolved = path.resolve(runDirectory.runDirectory);
    if (!artifactPath.startsWith(`${runDirResolved}${path.sep}`)) {
      throw new ArtifactLoaderError('INVALID_ARTIFACT_PATH', 'Invalid artifact path');
    }

    if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
      throw new ArtifactLoaderError('ARTIFACT_NOT_FOUND', 'Artifact not found');
    }

    const raw = fs.readFileSync(artifactPath);
    const kind = getPreviewKind(fileName);

    if (kind === 'markdown') {
      const markdown = raw.toString('utf8');
      return {
        runId,
        fileName,
        previewKind: 'markdown',
        content: {
          markdown,
          html: renderMarkdown(markdown)
        }
      };
    }

    if (kind === 'csv') {
      return {
        runId,
        fileName,
        previewKind: 'csv',
        content: {
          csv: parseCsv(raw.toString('utf8'))
        }
      };
    }

    if (kind === 'json') {
      const text = raw.toString('utf8');
      try {
        const parsed = JSON.parse(text) as unknown;
        return {
          runId,
          fileName,
          previewKind: 'json',
          content: {
            json: parsed,
            pretty: `${JSON.stringify(parsed, null, 2)}\n`
          }
        };
      } catch {
        return {
          runId,
          fileName,
          previewKind: 'text',
          content: {
            text
          }
        };
      }
    }

    if (kind === 'text') {
      return {
        runId,
        fileName,
        previewKind: 'text',
        content: {
          text: raw.toString('utf8')
        }
      };
    }

    if (isLikelyText(raw)) {
      return {
        runId,
        fileName,
        previewKind: 'text',
        content: {
          text: raw.toString('utf8')
        }
      };
    }

    return {
      runId,
      fileName,
      previewKind: 'unsupported',
      content: {
        unsupportedReason: 'Preview not supported for binary or unknown artifact type'
      }
    };
  }

  private discoverRunLocations(): RunLocation[] {
    if (!fs.existsSync(this.artifactsRoot)) {
      return [];
    }

    const entries = fs.readdirSync(this.artifactsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name));

    const selectedByRun = new Map<string, RunLocation>();

    for (const entry of entries) {
      const absolute = path.join(this.artifactsRoot, entry.name);

      if (entry.name.startsWith('run_')) {
        if (!selectedByRun.has(entry.name)) {
          selectedByRun.set(entry.name, {
            runId: entry.name,
            runDirectory: absolute
          });
        }
        continue;
      }

      const runEntries = fs.readdirSync(absolute, { withFileTypes: true })
        .filter((runEntry) => runEntry.isDirectory())
        .sort((left, right) => left.name.localeCompare(right.name));

      for (const runEntry of runEntries) {
        if (!isSafePathPart(runEntry.name)) {
          continue;
        }
        if (selectedByRun.has(runEntry.name)) {
          continue;
        }
        selectedByRun.set(runEntry.name, {
          runId: runEntry.name,
          missionId: entry.name,
          runDirectory: path.join(absolute, runEntry.name)
        });
      }
    }

    return [...selectedByRun.values()].sort((left, right) => left.runId.localeCompare(right.runId));
  }

  private resolveRunDirectory(runId: string): RunLocation | null {
    if (!isSafePathPart(runId)) {
      return null;
    }

    const locations = this.discoverRunLocations();
    for (const location of locations) {
      if (location.runId === runId) {
        return location;
      }
    }

    return null;
  }
}
