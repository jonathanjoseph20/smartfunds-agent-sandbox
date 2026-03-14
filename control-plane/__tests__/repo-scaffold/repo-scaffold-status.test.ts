import { describe, expect, it } from 'vitest';

import { deriveRepoScaffoldStatus } from '../../repo-scaffold/repo-scaffold-status.ts';

describe('repo scaffold status', () => {
  it('T-PF5-S1 returns draft for incomplete validation', () => {
    const status = deriveRepoScaffoldStatus({
      bundle: {
        directories: [],
        files: [],
        patchTargets: [],
      },
      validation: {
        validationState: 'incomplete',
        missingFields: ['bundleId'],
        violations: [],
        warnings: [],
      },
    });

    expect(status).toBe('draft');
  });

  it('T-PF5-S2 returns blocked for invalid validation', () => {
    const status = deriveRepoScaffoldStatus({
      bundle: {
        directories: ['src'],
        files: ['src/app.ts'],
        patchTargets: ['src/missing.ts'],
      },
      validation: {
        validationState: 'invalid',
        missingFields: [],
        violations: ['patch_target_not_declared_file:src/missing.ts'],
        warnings: [],
      },
    });

    expect(status).toBe('blocked');
  });

  it('T-PF5-S3 returns validated when structurally valid but not ready', () => {
    const status = deriveRepoScaffoldStatus({
      bundle: {
        directories: ['src'],
        files: ['src/app.ts'],
        patchTargets: [],
      },
      validation: {
        validationState: 'valid',
        missingFields: [],
        violations: [],
        warnings: [],
      },
    });

    expect(status).toBe('validated');
  });

  it('T-PF5-S4 returns ready deterministically for valid complete bundle', () => {
    const input = {
      bundle: {
        directories: ['src'],
        files: ['src/app.ts'],
        patchTargets: ['src/app.ts'],
      },
      validation: {
        validationState: 'valid' as const,
        missingFields: [],
        violations: [],
        warnings: [],
      },
    };

    expect(deriveRepoScaffoldStatus(input)).toBe('ready');
    expect(deriveRepoScaffoldStatus(input)).toBe('ready');
  });
});
