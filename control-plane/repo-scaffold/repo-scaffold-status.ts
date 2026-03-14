import type {
  RepoScaffoldStatus,
  RepoScaffoldValidationResult,
  RepositoryScaffoldBundle,
} from './repo-scaffold-types.ts';

export function deriveRepoScaffoldStatus(input: {
  bundle: Pick<RepositoryScaffoldBundle, 'directories' | 'files' | 'patchTargets'>;
  validation: RepoScaffoldValidationResult;
}): RepoScaffoldStatus {
  if (input.validation.missingFields.length > 0 || input.validation.validationState === 'incomplete') {
    return 'draft';
  }

  if (input.validation.violations.length > 0 || input.validation.validationState === 'invalid') {
    return 'blocked';
  }

  if (input.bundle.files.length === 0 || input.bundle.directories.length === 0 || input.bundle.patchTargets.length === 0) {
    return 'validated';
  }

  return 'ready';
}
