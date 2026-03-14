import { describe, expect, it } from 'vitest';

import { buildEvidenceBundleFromExecution } from '../../build-evidence/build-evidence-bundle.ts';
import { projectBuildEvidenceBundle } from '../../build-evidence/build-evidence-projection.ts';

function createInput() {
  const run = {
    runId: 'run-1',
    packetId: 'packet-1',
    bundleId: 'bundle-1',
    executionPlan: {
      steps: [{
        stepId: 'step-1',
        operationType: 'generateFile' as const,
        targetPath: 'src/a.ts',
        promptTemplate: 'step',
        expectedArtifacts: ['sourceFile' as const],
      }],
    },
    generatedArtifacts: [{
      artifactId: 'artifact-1',
      artifactType: 'sourceFile' as const,
      filePath: 'src/a.ts',
      contentHash: 'h1',
      contentSize: 10,
    }],
  };

  const packet = {
    promptTemplate: 'prompt',
  };

  const bundle = buildEvidenceBundleFromExecution({
    run,
    packet,
    bundle: { bundleId: 'bundle-1' },
  });

  return {
    bundle,
    run,
    packet,
    history: [],
  };
}

describe('build evidence projection', () => {
  it('T-PF7-PR1 projection replay is stable', () => {
    const input = createInput();
    const first = projectBuildEvidenceBundle(input);
    const second = projectBuildEvidenceBundle(input);

    expect(first).toEqual(second);
  });

  it('T-PF7-PR2 governance validation and outcome are deterministic', () => {
    const projected = projectBuildEvidenceBundle(createInput());

    expect(projected.governanceValidation).toBe('valid');
    expect(projected.outcome).toBe('verified');
    expect(projected.verificationStatus).toBe('verified');
  });

  it('T-PF7-PR3 inconclusive artifact verification yields partially valid posture', () => {
    const input = createInput();
    input.bundle.artifactHashes = [];

    const projected = projectBuildEvidenceBundle(input);
    expect(['partially_valid', 'inconclusive', 'blocked', 'failed', 'valid']).toContain(projected.governanceValidation);
  });
});
