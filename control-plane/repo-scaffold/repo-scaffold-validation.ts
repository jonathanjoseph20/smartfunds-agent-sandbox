import path from 'node:path';

import type {
  RepoScaffoldValidationResult,
  RepositoryScaffoldBundle,
  WorkspaceLayout,
} from './repo-scaffold-types.ts';
import {
  deriveDirectoriesFromFiles,
  normalizeDirectoryList,
  normalizeFileList,
} from './repo-scaffold-file-layout.ts';
import {
  normalizePatchTargets,
  validatePatchTargetsAgainstFiles,
} from './repo-scaffold-patch-plan.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function hasEmptyEntries(values: string[]): boolean {
  return values.some((value) => value.trim().length === 0);
}

function hasInvalidFragments(values: string[]): string[] {
  return values
    .map((entry) => normalizePath(entry))
    .filter((entry) => entry.includes('..') || entry.includes('//'));
}

function normalizeWorkspaceLayout(layout: WorkspaceLayout): WorkspaceLayout {
  const normalizeLayoutPath = (value: string): string => value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  return {
    root: layout.root.trim().replace(/\\/g, '/'),
    srcDir: normalizeLayoutPath(layout.srcDir),
    testsDir: normalizeLayoutPath(layout.testsDir),
    configDir: normalizeLayoutPath(layout.configDir),
    docsDir: normalizeLayoutPath(layout.docsDir),
  };
}

function validateWorkspaceLayout(layout: WorkspaceLayout, violations: string[], missingFields: string[]): WorkspaceLayout {
  const normalized = normalizeWorkspaceLayout(layout);

  if (normalized.root.length === 0) {
    missingFields.push('workspaceLayout.root');
  }

  const requiredRelativeDirs: Array<keyof WorkspaceLayout> = ['srcDir', 'testsDir', 'configDir', 'docsDir'];
  for (const field of requiredRelativeDirs) {
    if (normalized[field].length === 0) {
      missingFields.push(`workspaceLayout.${field}`);
    }
  }

  if (normalized.root.startsWith('/')) {
    violations.push('workspaceLayout_root_must_be_repo_relative');
  }

  for (const field of requiredRelativeDirs) {
    if (normalized[field].startsWith('/')) {
      violations.push(`workspaceLayout_${field}_must_be_relative`);
    }
    if (normalized[field].includes('..')) {
      violations.push(`workspaceLayout_${field}_invalid_fragment`);
    }
  }

  return normalized;
}

export function validateRepoScaffoldBundle(input: {
  bundle: Partial<RepositoryScaffoldBundle>;
  validArtifactDependencyIds?: Iterable<string>;
}): RepoScaffoldValidationResult {
  const missingFields: string[] = [];
  const violations: string[] = [];
  const warnings: string[] = [];

  if (!input.bundle.bundleId?.trim()) {
    missingFields.push('bundleId');
  }
  if (!input.bundle.packetId?.trim()) {
    missingFields.push('packetId');
  }
  if (!input.bundle.graphId?.trim()) {
    missingFields.push('graphId');
  }
  if (!input.bundle.taskId?.trim()) {
    missingFields.push('taskId');
  }
  if (!input.bundle.repoTarget?.trim()) {
    missingFields.push('repoTarget');
  }
  if (!input.bundle.workspaceLayout) {
    missingFields.push('workspaceLayout');
  }

  if (!Array.isArray(input.bundle.directories)) {
    missingFields.push('directories');
  }
  if (!Array.isArray(input.bundle.files)) {
    missingFields.push('files');
  }
  if (!Array.isArray(input.bundle.patchTargets)) {
    missingFields.push('patchTargets');
  }
  if (!Array.isArray(input.bundle.artifactDependencies)) {
    missingFields.push('artifactDependencies');
  }

  const directories = normalizeDirectoryList(input.bundle.directories ?? []);
  const files = normalizeFileList(input.bundle.files ?? []);
  const patchTargets = normalizePatchTargets(input.bundle.patchTargets ?? []);
  const artifactDependencies = uniqueSorted((input.bundle.artifactDependencies ?? []).map(normalizePath).filter((entry) => entry.length > 0));

  if ((input.bundle.directories ?? []).length !== directories.length) {
    warnings.push('directories_normalized');
  }
  if ((input.bundle.files ?? []).length !== files.length) {
    warnings.push('files_normalized');
  }
  if ((input.bundle.patchTargets ?? []).length !== patchTargets.length) {
    warnings.push('patchTargets_normalized');
  }
  if ((input.bundle.artifactDependencies ?? []).length !== artifactDependencies.length) {
    warnings.push('artifactDependencies_normalized');
  }

  if (hasEmptyEntries(input.bundle.directories ?? [])) {
    violations.push('directories_contains_empty');
  }
  if (hasEmptyEntries(input.bundle.files ?? [])) {
    violations.push('files_contains_empty');
  }
  if (hasEmptyEntries(input.bundle.patchTargets ?? [])) {
    violations.push('patchTargets_contains_empty');
  }
  if (hasEmptyEntries(input.bundle.artifactDependencies ?? [])) {
    violations.push('artifactDependencies_contains_empty');
  }

  for (const invalid of hasInvalidFragments(directories)) {
    violations.push(`invalid_directory_path:${invalid}`);
  }
  for (const invalid of hasInvalidFragments(files)) {
    violations.push(`invalid_file_path:${invalid}`);
  }
  for (const invalid of hasInvalidFragments(patchTargets)) {
    violations.push(`invalid_patch_target:${invalid}`);
  }

  const derivedDirectories = deriveDirectoriesFromFiles(files);
  const directorySet = new Set(directories);
  for (const derivedDirectory of derivedDirectories) {
    if (!directorySet.has(derivedDirectory)) {
      warnings.push(`derived_directory_missing_from_directories:${derivedDirectory}`);
    }
  }

  for (const file of files) {
    const directory = path.posix.dirname(file);
    const normalizedDirectory = directory === '.' ? '' : directory;
    if (normalizedDirectory.length > 0 && !directorySet.has(normalizedDirectory) && !derivedDirectories.includes(normalizedDirectory)) {
      violations.push(`file_directory_not_declared_or_derivable:${file}`);
    }
  }

  for (const missingTarget of validatePatchTargetsAgainstFiles({ patchTargets, files })) {
    violations.push(`patch_target_not_declared_file:${missingTarget}`);
  }

  const validArtifactDependencySet = input.validArtifactDependencyIds
    ? new Set(Array.from(input.validArtifactDependencyIds).map(normalizePath).filter((entry) => entry.length > 0))
    : null;

  if (validArtifactDependencySet) {
    for (const dependency of artifactDependencies) {
      if (!validArtifactDependencySet.has(dependency)) {
        warnings.push(`unknown_artifact_dependency_reference:${dependency}`);
      }
    }
  }

  if (input.bundle.repoTarget && input.bundle.repoTarget.startsWith('/')) {
    violations.push('repoTarget_must_be_repo_relative');
  }

  if (input.bundle.workspaceLayout) {
    validateWorkspaceLayout(input.bundle.workspaceLayout, violations, missingFields);
  }

  const sortedMissing = uniqueSorted(missingFields);
  const sortedViolations = uniqueSorted(violations);
  const sortedWarnings = uniqueSorted(warnings);

  if (sortedMissing.length > 0) {
    return {
      validationState: 'incomplete',
      missingFields: sortedMissing,
      violations: sortedViolations,
      warnings: sortedWarnings,
    };
  }

  if (sortedViolations.length > 0) {
    return {
      validationState: 'invalid',
      missingFields: sortedMissing,
      violations: sortedViolations,
      warnings: sortedWarnings,
    };
  }

  return {
    validationState: 'valid',
    missingFields: sortedMissing,
    violations: sortedViolations,
    warnings: sortedWarnings,
  };
}
