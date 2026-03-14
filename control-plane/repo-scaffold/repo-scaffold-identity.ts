import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { WorkspaceLayout } from './repo-scaffold-types.ts';

export type RepoScaffoldIdentityInput = {
  packetId: string;
  repoTarget: string;
  directories: string[];
  files: string[];
  patchTargets: string[];
  artifactDependencies: string[];
  workspaceLayout: WorkspaceLayout;
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeString(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

function normalizeLayout(layout: WorkspaceLayout): WorkspaceLayout {
  return {
    root: normalizeString(layout.root),
    srcDir: normalizeString(layout.srcDir),
    testsDir: normalizeString(layout.testsDir),
    configDir: normalizeString(layout.configDir),
    docsDir: normalizeString(layout.docsDir),
  };
}

export function normalizeRepoScaffoldIdentityInput(
  input: RepoScaffoldIdentityInput,
): RepoScaffoldIdentityInput {
  return {
    packetId: normalizeString(input.packetId),
    repoTarget: normalizeString(input.repoTarget),
    directories: uniqueSorted(input.directories.map(normalizeString).filter((entry) => entry.length > 0)),
    files: uniqueSorted(input.files.map(normalizeString).filter((entry) => entry.length > 0)),
    patchTargets: uniqueSorted(input.patchTargets.map(normalizeString).filter((entry) => entry.length > 0)),
    artifactDependencies: uniqueSorted(input.artifactDependencies.map(normalizeString).filter((entry) => entry.length > 0)),
    workspaceLayout: normalizeLayout(input.workspaceLayout),
  };
}

export function deriveRepoScaffoldBundleId(input: RepoScaffoldIdentityInput): string {
  const normalized = normalizeRepoScaffoldIdentityInput(input);
  return sha256(canonicalStringify(normalized));
}
