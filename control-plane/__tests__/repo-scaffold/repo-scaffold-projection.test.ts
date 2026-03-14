import { describe, expect, it } from 'vitest';

import {
  listRepoScaffoldBundleProjections,
  projectRepoScaffoldBundle,
} from '../../repo-scaffold/repo-scaffold-projection.ts';

describe('repo scaffold projection', () => {
  it('T-PF5-P1 emits projection fields and correct counts', () => {
    const projection = projectRepoScaffoldBundle({
      bundle: {
        bundleId: 'bundle-1',
        packetId: 'packet-1',
        graphId: 'graph-1',
        taskId: 'task-1',
        repoTarget: '.',
        directories: ['src', 'tests'],
        files: ['src/app.ts', 'tests/app.test.ts'],
        patchTargets: ['src/app.ts'],
        artifactDependencies: ['task-a'],
        workspaceLayout: {
          root: '.',
          srcDir: 'src',
          testsDir: 'tests',
          configDir: 'config',
          docsDir: 'docs',
        },
        status: 'ready',
      },
      validation: {
        validationState: 'valid',
        missingFields: [],
        violations: [],
        warnings: [],
      },
      history: [],
    });

    expect(projection).toEqual({
      bundleId: 'bundle-1',
      packetId: 'packet-1',
      graphId: 'graph-1',
      taskId: 'task-1',
      repoTarget: '.',
      status: 'ready',
      validationState: 'valid',
      directoryCount: 2,
      fileCount: 2,
      patchTargetCount: 1,
      artifactDependencyCount: 1,
      rootDir: '.',
      warningsCount: 0,
      violationsCount: 0,
    });
  });

  it('T-PF5-P2 projection list ordering is stable', () => {
    const bundles = [
      {
        bundleId: 'bundle-b',
        packetId: 'packet-b',
        graphId: 'graph-1',
        taskId: 'task-b',
        repoTarget: '.',
        directories: ['src'],
        files: ['src/b.ts'],
        patchTargets: ['src/b.ts'],
        artifactDependencies: [],
        workspaceLayout: {
          root: '.',
          srcDir: 'src',
          testsDir: 'tests',
          configDir: 'config',
          docsDir: 'docs',
        },
        status: 'ready' as const,
      },
      {
        bundleId: 'bundle-a',
        packetId: 'packet-a',
        graphId: 'graph-1',
        taskId: 'task-a',
        repoTarget: '.',
        directories: ['src'],
        files: ['src/a.ts'],
        patchTargets: ['src/a.ts'],
        artifactDependencies: [],
        workspaceLayout: {
          root: '.',
          srcDir: 'src',
          testsDir: 'tests',
          configDir: 'config',
          docsDir: 'docs',
        },
        status: 'ready' as const,
      },
    ];

    const projected = listRepoScaffoldBundleProjections({
      bundles,
      getValidation: () => ({
        validationState: 'valid',
        missingFields: [],
        violations: [],
        warnings: [],
      }),
      getHistory: () => [],
    });

    expect(projected.map((entry) => entry.bundleId)).toEqual(['bundle-a', 'bundle-b']);
  });
});
