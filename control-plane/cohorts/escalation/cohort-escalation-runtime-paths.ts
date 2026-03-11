import fs from 'node:fs';
import path from 'node:path';

function normalizeRelativeSegment(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}: ${value}`);
  }
  return normalized;
}

export const DEFAULT_COHORT_ARTIFACTS_ROOT = path.join('artifacts', 'cohorts');

export function resolveCohortEscalationArtifactDir(input: { cohortId: string; rootDir?: string }): string {
  const cohortId = normalizeRelativeSegment(input.cohortId, 'cohort_id');
  return path.join(path.resolve(input.rootDir ?? DEFAULT_COHORT_ARTIFACTS_ROOT), cohortId, 'escalation');
}

export function ensureCohortEscalationArtifactDir(input: { cohortId: string; rootDir?: string }): string {
  const dirPath = resolveCohortEscalationArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveCohortEscalationArtifactPaths(input: { cohortId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
} {
  const dirPath = resolveCohortEscalationArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'escalation-status.json'),
    historyJsonPath: path.join(dirPath, 'escalation-history.json')
  };
}
