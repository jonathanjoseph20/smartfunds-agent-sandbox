import fs from 'node:fs';
import path from 'node:path';

function normalizeRelativeSegment(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}: ${value}`);
  }
  return normalized;
}

export const DEFAULT_COHORT_PROGRAM_ARTIFACTS_ROOT = path.join('artifacts', 'cohorts');

export function resolveCohortProgramArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_COHORT_PROGRAM_ARTIFACTS_ROOT);
}

export function resolveCohortProgramArtifactDir(input: { cohortId: string; programId: string; rootDir?: string }): string {
  const cohortId = normalizeRelativeSegment(input.cohortId, 'cohort_id');
  const programId = normalizeRelativeSegment(input.programId, 'program_id');
  return path.join(resolveCohortProgramArtifactsRoot(input.rootDir), cohortId, 'programs', programId);
}

export function ensureCohortProgramArtifactDir(input: { cohortId: string; programId: string; rootDir?: string }): string {
  const dirPath = resolveCohortProgramArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveCohortProgramArtifactPaths(input: { cohortId: string; programId: string; rootDir?: string }): {
  dirPath: string;
  statusJsonPath: string;
  historyJsonPath: string;
  automationStatusJsonPath: string;
  automationHistoryJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveCohortProgramArtifactDir(input);
  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'program-status.json'),
    historyJsonPath: path.join(dirPath, 'program-history.json'),
    automationStatusJsonPath: path.join(dirPath, 'program-automation-status.json'),
    automationHistoryJsonPath: path.join(dirPath, 'program-automation-history.json'),
    reportMarkdownPath: path.join(dirPath, 'program-report.md')
  };
}
