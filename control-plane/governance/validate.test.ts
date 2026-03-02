import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { runGovernanceValidation } from './validate.ts';
import { buildCanonicalEvidence, stringifyEvidenceJson } from './evidence-contract.ts';

describe('governance validate evidence contract', () => {
  it('fails with exact missing evidence.json error', async () => {
    const originalExistsSync = fs.existsSync.bind(fs);
    vi.spyOn(fs, 'existsSync').mockImplementation((filePath: fs.PathLike) => {
      const normalized = String(filePath);
      if (normalized === 'governance/evidence.json') {
        return false;
      }
      return originalExistsSync(filePath);
    });

    try {
      const result = await runGovernanceValidation({
        prData: {
          body: 'tier-1\n\n```evidence\nRisk Tier: 1\n```',
          labels: ['tier-1'],
          changedFiles: ['apps/api/src/index.ts']
        }
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('Missing governance/evidence.json');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('fails when evidence json is malformed', async () => {
    const originalExistsSync = fs.existsSync.bind(fs);
    const originalReadFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, 'existsSync').mockImplementation((filePath: fs.PathLike) => {
      const normalized = String(filePath);
      if (normalized === 'governance/evidence.json' || normalized === 'governance/schema/evidence.schema.json') {
        return true;
      }
      return originalExistsSync(filePath);
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((filePath: fs.PathOrFileDescriptor, options?: BufferEncoding | { encoding?: BufferEncoding | null; flag?: string } | null) => {
      const normalized = String(filePath);
      if (normalized === 'governance/evidence.json') {
        return '{';
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalReadFileSync(filePath as any, options as any);
    });

    try {
      const result = await runGovernanceValidation({
        prData: {
          body: 'informational-only body',
          labels: ['tier-1'],
          changedFiles: ['apps/api/src/index.ts']
        }
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join('\n')).toContain('governance/evidence.json is not valid JSON');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('fails when evidence tier mismatches label tier', async () => {
    const originalExistsSync = fs.existsSync.bind(fs);
    const originalReadFileSync = fs.readFileSync.bind(fs);
    const schema = originalReadFileSync('governance/schema/evidence.schema.json', 'utf8');
    const evidence = stringifyEvidenceJson(
      buildCanonicalEvidence({
        tier: 2,
        mode: 'autonomous',
        affectedPaths: ['apps/api/src/index.ts'],
        determinismStatement: 'No identity surfaces mutated.',
        retrySemanticsModified: false,
        autonomyScopeExpanded: false
      })
    );
    vi.spyOn(fs, 'existsSync').mockImplementation((filePath: fs.PathLike) => {
      const normalized = String(filePath);
      if (normalized === 'governance/evidence.json' || normalized === 'governance/schema/evidence.schema.json') {
        return true;
      }
      return originalExistsSync(filePath);
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((filePath: fs.PathOrFileDescriptor, options?: BufferEncoding | { encoding?: BufferEncoding | null; flag?: string } | null) => {
      const normalized = String(filePath);
      if (normalized === 'governance/evidence.json') {
        return evidence;
      }
      if (normalized === 'governance/schema/evidence.schema.json') {
        return schema;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalReadFileSync(filePath as any, options as any);
    });

    try {
      const result = await runGovernanceValidation({
        prData: {
          body: 'informational-only body',
          labels: ['tier-1'],
          changedFiles: ['apps/api/src/index.ts']
        }
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join('\n')).toContain('governance/evidence.json tier must be 1');
    } finally {
      vi.restoreAllMocks();
    }
  });
});
