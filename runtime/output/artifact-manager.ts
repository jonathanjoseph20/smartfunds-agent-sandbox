import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_ROOT = 'artifacts';

function sanitizePathPart(value: string, field: 'missionId' | 'runId'): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.includes('/') || normalized.includes('\\') || normalized.includes('..')) {
    throw new Error(`ERR_ARTIFACT_PATH: invalid ${field}`);
  }
  return normalized;
}

export function resolveArtifactDirectory(missionId: string, runId: string): string {
  const safeMissionId = sanitizePathPart(missionId, 'missionId');
  const safeRunId = sanitizePathPart(runId, 'runId');
  return path.join(ARTIFACTS_ROOT, safeMissionId, safeRunId);
}

export function ensureArtifactDirectory(missionId: string, runId: string): string {
  const directory = resolveArtifactDirectory(missionId, runId);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}
