import type {
  RepoScaffoldHistoryEvent,
  RepoScaffoldProjection,
  RepoScaffoldValidationResult,
  RepositoryScaffoldBundle,
} from './repo-scaffold-types.ts';

export function projectRepoScaffoldBundle(input: {
  bundle: RepositoryScaffoldBundle;
  validation: RepoScaffoldValidationResult;
  history: RepoScaffoldHistoryEvent[];
}): RepoScaffoldProjection {
  return {
    bundleId: input.bundle.bundleId,
    packetId: input.bundle.packetId,
    graphId: input.bundle.graphId,
    taskId: input.bundle.taskId,
    repoTarget: input.bundle.repoTarget,
    status: input.bundle.status,
    validationState: input.validation.validationState,
    directoryCount: [...input.bundle.directories].length,
    fileCount: [...input.bundle.files].length,
    patchTargetCount: [...input.bundle.patchTargets].length,
    artifactDependencyCount: [...input.bundle.artifactDependencies].length,
    rootDir: input.bundle.workspaceLayout.root,
    warningsCount: input.validation.warnings.length,
    violationsCount: input.validation.violations.length,
  };
}

export function listRepoScaffoldBundleProjections(input: {
  bundles: RepositoryScaffoldBundle[];
  getValidation: (bundleId: string) => RepoScaffoldValidationResult;
  getHistory: (bundleId: string) => RepoScaffoldHistoryEvent[];
}): RepoScaffoldProjection[] {
  return [...input.bundles]
    .sort((left, right) => left.bundleId.localeCompare(right.bundleId))
    .map((bundle) => projectRepoScaffoldBundle({
      bundle,
      validation: input.getValidation(bundle.bundleId),
      history: input.getHistory(bundle.bundleId),
    }))
    .sort((left, right) => left.bundleId.localeCompare(right.bundleId));
}
