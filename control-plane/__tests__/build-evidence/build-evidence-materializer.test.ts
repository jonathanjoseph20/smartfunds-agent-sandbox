import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBuildEvidenceMaterializer } from '../../build-evidence/build-evidence-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'build-evidence', 'tmp-build-evidence-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('build evidence materializer', () => {
  it('T-PF7-M1 writes deterministic artifact files and appends materialization event', () => {
    const appendBuildEvidenceEvent = vi.fn();
    const verifyBuildEvidenceBundle = vi.fn(() => ({
      buildEvidenceBundleId: 'be-1',
      runId: 'run-1',
      packetId: 'packet-1',
      bundleId: 'bundle-1',
      artifactVerificationSummaries: [{ artifactVerificationId: 'av-1' }],
      promptAttestationSummary: { promptAttestationId: 'pa-1' },
      executionPlanAttestationSummary: { executionPlanAttestationId: 'ea-1' },
      governanceValidation: 'valid',
      verificationStatus: 'verified',
      outcome: 'verified',
      evidenceHistory: [],
    }));

    const materializer = createBuildEvidenceMaterializer({
      manager: {
        verifyBuildEvidenceBundle,
        appendBuildEvidenceEvent,
      } as never,
      artifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const first = materializer.materializeBuildEvidenceBundle('be-1');
    const second = materializer.materializeBuildEvidenceBundle('be-1');

    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.existsSync(first.reportMarkdownPath)).toBe(true);
    expect(appendBuildEvidenceEvent).toHaveBeenCalled();
  });
});
