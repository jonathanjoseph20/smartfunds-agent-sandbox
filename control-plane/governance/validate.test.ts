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

describe('governance validate tier routing', () => {
  it('fails lite mode when tier label is missing', async () => {
    const result = await runGovernanceValidation({
      mode: 'lite',
      prData: {
        body: '',
        labels: [],
        changedFiles: ['docs/readme.md']
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('MISSING_TIER_LABEL');
  });

  it('fails lite mode with SPLIT_REQUIRED for low-tier PRs touching restricted paths', async () => {
    const result = await runGovernanceValidation({
      mode: 'lite',
      prData: {
        body: '',
        labels: ['tier-1'],
        changedFiles: ['control-plane/validate-pr.ts']
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('SPLIT_REQUIRED');
    expect(result.errors.join('\n')).toContain('control-plane/validate-pr.ts');
  });

  it('fails with TIER_LABEL_TOO_LOW when label is below implied tier outside low-tier split boundary', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: '',
        labels: ['tier-2'],
        changedFiles: ['governance/evidence.json']
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('TIER_LABEL_TOO_LOW');
  });

  it('fails full mode when change.json is missing', async () => {
    await withMockedDeclaration(null, async () => {
      const result = await runGovernanceValidation({
        mode: 'full',
        prData: {
          body: '',
          labels: ['tier-2'],
          changedFiles: ['apps/api/src/index.ts']
        }
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join('\n')).toContain('Missing governance/change.json');
    });
  });

  it('fails full mode when change.json tier does not match label tier', async () => {
    const declaration = JSON.stringify({
      tier: 1,
      mode: 'structured',
      justification: 'test'
    });

    await withMockedDeclaration(declaration, async () => {
      const result = await runGovernanceValidation({
        mode: 'full',
        prData: {
          body: '',
          labels: ['tier-2'],
          changedFiles: ['apps/api/src/index.ts']
        }
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join('\n')).toContain('Risk tier mismatch');
    });
  });
});
