import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SYNTHESIS_ARTIFACTS_ROOT = path.join('artifacts', 'syntheses');

function normalizeRelativeSegment(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}: ${value}`);
  }
  return normalized;
}

export function resolveSynthesisArtifactsRoot(rootDir?: string): string {
  return path.resolve(rootDir ?? DEFAULT_SYNTHESIS_ARTIFACTS_ROOT);
}

export function resolveSynthesisArtifactDir(input: { synthesisId: string; rootDir?: string }): string {
  const synthesisId = normalizeRelativeSegment(input.synthesisId, 'synthesis_id');
  return path.join(resolveSynthesisArtifactsRoot(input.rootDir), synthesisId);
}

export function ensureSynthesisArtifactDir(input: { synthesisId: string; rootDir?: string }): string {
  const dirPath = resolveSynthesisArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveSynthesisArtifactPaths(input: { synthesisId: string; rootDir?: string }): {
  dirPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  statusJsonPath: string;
  conflictsJsonPath: string;
} {
  const dirPath = resolveSynthesisArtifactDir(input);
  return {
    dirPath,
    reportJsonPath: path.join(dirPath, 'synthesis-report.json'),
    reportMarkdownPath: path.join(dirPath, 'synthesis-report.md'),
    statusJsonPath: path.join(dirPath, 'synthesis-status.json'),
    conflictsJsonPath: path.join(dirPath, 'synthesis-conflicts.json')
  };
}
