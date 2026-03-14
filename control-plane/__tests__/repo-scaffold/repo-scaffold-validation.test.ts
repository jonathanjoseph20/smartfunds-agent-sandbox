import { describe, expect, it } from 'vitest';

import { validateRepoScaffoldBundle } from '../../repo-scaffold/repo-scaffold-validation.ts';

const validBundle = {
  bundleId: 'bundle-1',
  packetId: 'packet-1',
  graphId: 'graph-1',
  taskId: 'task-1',
  repoTarget: '.',
  directories: ['docs', 'src', 'tests'],
  files: ['docs/readme.md', 'src/app.ts', 'tests/app.test.ts'],
  patchTargets: ['src/app.ts'],
  artifactDependencies: ['task-a'],
  workspaceLayout: {
    root: '.',
    srcDir: 'src',
    testsDir: 'tests',
    configDir: 'config',
    docsDir: 'docs',
  },
  status: 'draft' as const,
};

describe('repo scaffold validation', () => {
  it('T-PF5-V1 valid bundle passes', () => {
    const result = validateRepoScaffoldBundle({
      bundle: validBundle,
      validArtifactDependencyIds: ['task-a', 'artifact-1'],
    });

    expect(result.validationState).toBe('valid');
    expect(result.missingFields).toEqual([]);
    expect(result.violations).toEqual([]);
  });

  it('T-PF5-V2 duplicate directories/files normalized with warning', () => {
    const result = validateRepoScaffoldBundle({
      bundle: {
        ...validBundle,
        directories: ['src', 'src', 'tests'],
        files: ['src/app.ts', 'src/app.ts', 'tests/app.test.ts'],
      },
      validArtifactDependencyIds: ['task-a'],
    });

    expect(result.validationState).toBe('valid');
    expect(result.warnings).toContain('directories_normalized');
    expect(result.warnings).toContain('files_normalized');
  });

  it('T-PF5-V3 patch target must reference declared file', () => {
    const result = validateRepoScaffoldBundle({
      bundle: {
        ...validBundle,
        patchTargets: ['src/missing.ts'],
      },
      validArtifactDependencyIds: ['task-a'],
    });

    expect(result.validationState).toBe('invalid');
    expect(result.violations).toContain('patch_target_not_declared_file:src/missing.ts');
  });

  it('T-PF5-V4 artifact dependency validation emits warning for unknown references', () => {
    const result = validateRepoScaffoldBundle({
      bundle: {
        ...validBundle,
        artifactDependencies: ['task-missing'],
      },
      validArtifactDependencyIds: ['task-a'],
    });

    expect(result.validationState).toBe('valid');
    expect(result.warnings).toContain('unknown_artifact_dependency_reference:task-missing');
  });

  it('T-PF5-V5 workspace layout and required field validation works', () => {
    const result = validateRepoScaffoldBundle({
      bundle: {
        ...validBundle,
        bundleId: '',
        workspaceLayout: {
          root: '/abs',
          srcDir: '/src',
          testsDir: 'tests',
          configDir: 'config',
          docsDir: 'docs',
        },
      },
      validArtifactDependencyIds: ['task-a'],
    });

    expect(result.validationState).toBe('incomplete');
    expect(result.missingFields).toContain('bundleId');
    expect(result.violations).toContain('workspaceLayout_root_must_be_repo_relative');
    expect(result.violations).toContain('workspaceLayout_srcDir_must_be_relative');
  });
});
