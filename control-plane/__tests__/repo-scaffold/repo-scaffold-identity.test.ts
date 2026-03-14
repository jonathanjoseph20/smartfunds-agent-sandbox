import { describe, expect, it } from 'vitest';

import {
  deriveRepoScaffoldBundleId,
  normalizeRepoScaffoldIdentityInput,
} from '../../repo-scaffold/repo-scaffold-identity.ts';

describe('repo scaffold identity', () => {
  it('T-PF5-I1 identical semantic inputs produce identical bundleId', () => {
    const input = {
      packetId: 'packet-1',
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
    };

    expect(deriveRepoScaffoldBundleId(input)).toBe(deriveRepoScaffoldBundleId(input));
  });

  it('T-PF5-I2 status and excluded fields do not change bundleId', () => {
    const base = {
      packetId: 'packet-1',
      repoTarget: '.',
      directories: ['src'],
      files: ['src/app.ts'],
      patchTargets: ['src/app.ts'],
      artifactDependencies: ['task-a'],
      workspaceLayout: {
        root: '.',
        srcDir: 'src',
        testsDir: 'tests',
        configDir: 'config',
        docsDir: 'docs',
      },
    };

    const withExtraA = {
      ...base,
      status: 'draft',
      materializedPath: 'artifacts/a',
    };
    const withExtraB = {
      ...base,
      status: 'ready',
      materializedPath: 'artifacts/b',
    };

    expect(deriveRepoScaffoldBundleId(base)).toBe(deriveRepoScaffoldBundleId(withExtraA));
    expect(deriveRepoScaffoldBundleId(base)).toBe(deriveRepoScaffoldBundleId(withExtraB));
  });

  it('T-PF5-I3 ordering normalization prevents hash drift', () => {
    const first = {
      packetId: 'packet-1',
      repoTarget: '.',
      directories: ['tests', 'src'],
      files: ['tests/app.test.ts', 'src/app.ts'],
      patchTargets: ['src/app.ts', 'tests/app.test.ts'],
      artifactDependencies: ['task-b', 'task-a'],
      workspaceLayout: {
        root: '.',
        srcDir: 'src',
        testsDir: 'tests',
        configDir: 'config',
        docsDir: 'docs',
      },
    };

    const second = {
      ...first,
      directories: ['src', 'tests'],
      files: ['src/app.ts', 'tests/app.test.ts'],
      patchTargets: ['tests/app.test.ts', 'src/app.ts'],
      artifactDependencies: ['task-a', 'task-b'],
    };

    expect(deriveRepoScaffoldBundleId(first)).toBe(deriveRepoScaffoldBundleId(second));
    expect(normalizeRepoScaffoldIdentityInput(first)).toEqual(normalizeRepoScaffoldIdentityInput(second));
  });
});
