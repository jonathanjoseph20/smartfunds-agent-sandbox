import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { runGovernanceValidation } from './validate.ts';
import { buildCanonicalEvidence, stringifyEvidenceJson } from './evidence-contract.ts';

function withMockedEvidence(evidenceContent: string, run: () => Promise<void>): Promise<void> {
  const originalExistsSync = fs.existsSync.bind(fs);
  const originalReadFileSync = fs.readFileSync.bind(fs);
  const schema = originalReadFileSync('governance/schema/evidence.schema.json', 'utf8');
  vi.spyOn(fs, 'existsSync').mockImplementation((filePath: fs.PathLike) => {
    const normalized = String(filePath);
    if (normalized === 'governance/evidence.json' || normalized === 'governance/schema/evidence.schema.json') {
      return true;
    }
    return originalExistsSync(filePath);
  });
  vi.spyOn(fs, 'readFileSync').mockImplementation(
    (filePath: fs.PathOrFileDescriptor, options?: BufferEncoding | { encoding?: BufferEncoding | null; flag?: string } | null) => {
      const normalized = String(filePath);
      if (normalized === 'governance/evidence.json') {
        return evidenceContent;
      }
      if (normalized === 'governance/schema/evidence.schema.json') {
        return schema;
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
        body: 'tier-1\n\n```evidence\nRisk Tier: 1\nJustification: ok\nAffected Paths: docs/readme.md\nTests Added: npm test\nDeterminism Statement: deterministic\n```',
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
        body: 'tier-1\n\n```evidence\nRisk Tier: 1\nJustification: ok\nAffected Paths: control-plane/validate-pr.ts\nTests Added: npm test\nDeterminism Statement: deterministic\n```',
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
        body: 'tier-2\n\n```evidence\nRisk Tier: 2\nJustification: ok\nAffected Paths: governance/evidence.json\nTests Added: npm test\nDeterminism Statement: deterministic\n```',
        labels: ['tier-2'],
        changedFiles: ['governance/evidence.json']
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('TIER_LABEL_TOO_LOW');
  });

  it('fails tier-2 full mode on semantic evidence drift with deterministic remediation', async () => {
    const evidence = stringifyEvidenceJson(
      buildCanonicalEvidence({
        tier: 2,
        mode: 'autonomous',
        affectedPaths: ['apps/api/src/other.ts'],
        determinismStatement: 'No identity surfaces mutated.',
        retrySemanticsModified: false,
        autonomyScopeExpanded: false
      })
    );

    await withMockedEvidence(evidence, async () => {
      const result = await runGovernanceValidation({
        mode: 'full',
        prData: {
          body: 'tier-2\n\n```evidence\nRisk Tier: 2\nJustification: ok\nAffected Paths: apps/api/src/index.ts\nTests Added: npm test\nDeterminism Statement: deterministic\n```',
          labels: ['tier-2'],
          changedFiles: ['apps/api/src/index.ts']
        }
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join('\n')).toContain('Evidence drift detected. Run: npm run governance:emit');
    });
  });

  it('accepts non-canonical evidence formatting when semantic content matches', async () => {
    const nonCanonical = '{\"tier\":2,\"mode\":\"autonomous\",\"affectedPaths\":[\"apps/api/src/index.ts\"],\"determinismStatement\":\"Deterministic evidence generation from PR metadata using canonical JSON and stable ordering.\",\"retrySemanticsModified\":false,\"autonomyScopeExpanded\":false}\n';

    await withMockedEvidence(nonCanonical, async () => {
      const result = await runGovernanceValidation({
        mode: 'full',
        prData: {
          body: 'tier-2\n\n```evidence\nRisk Tier: 2\nJustification: ok\nAffected Paths: apps/api/src/index.ts\nTests Added: npm test\nDeterminism Statement: deterministic\n```',
          labels: ['tier-2'],
          changedFiles: ['apps/api/src/index.ts']
        }
      });

      expect(result.ok).toBe(true);
    });
  });
});
