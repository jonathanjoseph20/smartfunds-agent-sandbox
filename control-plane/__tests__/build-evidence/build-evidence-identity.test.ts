import { describe, expect, it } from 'vitest';

import { deriveBuildEvidenceBundleId } from '../../build-evidence/build-evidence-identity.ts';

describe('build evidence identity', () => {
  it('T-PF7-I1 deterministic bundle identity for semantically equal payloads', () => {
    const payload = {
      runId: 'run-1',
      packetId: 'packet-1',
      bundleId: 'bundle-1',
      promptHash: 'prompt-hash',
      executionPlanHash: 'plan-hash',
      artifactHashes: [
        { artifactId: 'a-2', artifactClass: 'sourceFile', filePath: 'src/b.ts', contentHash: 'h2' },
        { artifactId: 'a-1', artifactClass: 'sourceFile', filePath: 'src/a.ts', contentHash: 'h1' },
      ],
    };

    const reordered = {
      ...payload,
      artifactHashes: [...payload.artifactHashes].reverse(),
      observedAt: 'runtime-only',
    };

    expect(deriveBuildEvidenceBundleId(payload)).toBe(deriveBuildEvidenceBundleId(reordered));
  });

  it('T-PF7-I2 included field changes produce different identity', () => {
    const base = {
      runId: 'run-1',
      packetId: 'packet-1',
      bundleId: 'bundle-1',
      promptHash: 'prompt-hash',
      executionPlanHash: 'plan-hash',
      artifactHashes: [
        { artifactId: 'a-1', artifactClass: 'sourceFile', filePath: 'src/a.ts', contentHash: 'h1' },
      ],
    };

    const changed = {
      ...base,
      executionPlanHash: 'plan-hash-changed',
    };

    expect(deriveBuildEvidenceBundleId(base)).not.toBe(deriveBuildEvidenceBundleId(changed));
  });
});
