import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_COHORT_ARTIFACTS_ROOT = path.join('artifacts', 'cohorts');

function normalizeRelativeSegment(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}: ${value}`);
  }
  return normalized;
}

export function resolveCohortArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_COHORT_ARTIFACTS_ROOT);
}

export function resolveCohortArtifactDir(input: { cohortId: string; rootDir?: string }): string {
  const cohortId = normalizeRelativeSegment(input.cohortId, 'cohort_id');
  return path.join(resolveCohortArtifactsRoot(input.rootDir), cohortId);
}

export function ensureCohortArtifactDir(input: { cohortId: string; rootDir?: string }): string {
  const dirPath = resolveCohortArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveCohortArtifactPaths(input: { cohortId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveCohortArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'cohort-status.json'),
    reportJsonPath: path.join(dirPath, 'cohort-report.json'),
    reportMarkdownPath: path.join(dirPath, 'cohort-report.md')
  };
}
