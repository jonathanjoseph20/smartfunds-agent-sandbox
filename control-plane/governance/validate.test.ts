import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { runGovernanceValidation } from './validate.ts';

function withMockedDeclaration(
  declarationContent: string | null,
  run: () => Promise<void>
): Promise<void> {
  const originalExistsSync = fs.existsSync.bind(fs);
  const originalReadFileSync = fs.readFileSync.bind(fs);

  vi.spyOn(fs, 'existsSync').mockImplementation((filePath: fs.PathLike) => {
    if (String(filePath) === 'governance/change.json') {
      return declarationContent !== null;
    }
    return originalExistsSync(filePath);
  });

  vi.spyOn(fs, 'readFileSync').mockImplementation(
    (
      filePath: fs.PathOrFileDescriptor,
      options?: BufferEncoding | { encoding?: BufferEncoding | null; flag?: string } | null
    ) => {
      if (String(filePath) === 'governance/change.json') {
        return declarationContent ?? '';
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalReadFileSync(filePath as any, options as any);
    }
  );

  return run().finally(() => {
    vi.restoreAllMocks();
  });
}

describe('governance validate profile routing', () => {
  it('T-GVR1 supports route-only detection with fallback classification', async () => {
    const result = await runGovernanceValidation({
      mode: 'route',
      prData: {
        body: '',
        labels: [],
        changedFiles: ['docs/readme.md']
      }
    });

    expect(result.ok).toBe(true);
    expect(result.routing.source).toBe('fallback');
    expect(result.routing.requiredProfile).toBe('build');
    expect(result.routing.finalProfile).toBe('build');
  });

  it('T-GVR2 uses metadata profile detection when present', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: [
          'tier-3',
          '',
          '```evidence',
          'profile: build',
          'Mission ID: test',
          'Run ID: test',
          '```'
        ].join('\n'),
        labels: [],
        changedFiles: ['docs/readme.md']
      }
    });

    expect(result.ok).toBe(true);
    expect(result.routing.source).toBe('metadata');
    expect(result.routing.requestedProfile).toBe('build');
    expect(result.routing.finalProfile).toBe('build');
  });

  it('T-GVR3 allows build route without tier/evidence enforcement', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: '',
        labels: [],
        changedFiles: ['docs/readme.md']
      }
    });

    expect(result.ok).toBe(true);
    expect(result.routing.finalProfile).toBe('build');
    expect(result.errors).toEqual([]);
    expect(result.report.requiredChecks).toEqual(['lint', 'policy_validation', 'scope_enforcement', 'tests']);
  });

  it('T-GVR4 hard-fails when requested build overlaps core scope', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: 'profile: build',
        labels: [],
        changedFiles: ['control-plane/governance/validate.ts']
      }
    });

    expect(result.ok).toBe(false);
    expect(result.routing.requiredProfile).toBe('core');
    expect(result.errors).toContain('BUILD_REQUESTED_PROFILE_REQUIRES_CORE_SCOPE');
  });

  it('T-GVR5 keeps core route strict with legacy checks', async () => {
    await withMockedDeclaration(null, async () => {
      const result = await runGovernanceValidation({
        mode: 'full',
        prData: {
          body: '',
          labels: [],
          changedFiles: ['control-plane/governance/validate.ts']
        }
      });

      expect(result.ok).toBe(false);
      expect(result.routing.finalProfile).toBe('core');
      expect(result.errors.join('\n')).toContain('MISSING_TIER_LABEL');
      expect(result.errors.join('\n')).toContain('MISSING_EVIDENCE_BLOCK');
    });
  });

  it('T-GVR6 supports lite skip behavior', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: 'profile: lite',
        labels: [],
        changedFiles: []
      }
    });

    expect(result.ok).toBe(true);
    expect(result.routing.finalProfile).toBe('lite');
    expect(result.report.requiredChecks).toEqual([]);
    expect(result.report.warnings).toContain('Governance enforcement skipped: profile route resolved to lite.');
  });
});
