import type {
  RepoScaffoldPatchPlan,
  RepositoryScaffoldBundle,
} from './repo-scaffold-types.ts';

import { normalizeFileList } from './repo-scaffold-file-layout.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

export function normalizePatchTargets(patchTargets: string[]): string[] {
  return uniqueSorted(
    patchTargets
      .map(normalizePath)
      .filter((entry) => entry.length > 0),
  );
}

export function validatePatchTargetsAgainstFiles(input: {
  patchTargets: string[];
  files: string[];
}): string[] {
  const files = new Set(normalizeFileList(input.files));
  const targets = normalizePatchTargets(input.patchTargets);

  return targets.filter((target) => !files.has(target));
}

export function buildRepoScaffoldPatchPlan(bundle: RepositoryScaffoldBundle): RepoScaffoldPatchPlan {
  const files = normalizeFileList(bundle.files);
  const patchTargets = normalizePatchTargets(bundle.patchTargets);
  const missingFromFiles = validatePatchTargetsAgainstFiles({
    patchTargets,
    files,
  });

  return {
    bundleId: bundle.bundleId,
    patchTargets,
    missingFromFiles,
    fileCount: files.length,
    patchTargetCount: patchTargets.length,
  };
}
