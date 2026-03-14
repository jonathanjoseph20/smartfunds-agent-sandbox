import { describe, expect, it } from 'vitest';

import {
  deriveBuildExecutionRunId,
} from '../../build-runtime/build-execution-identity.ts';

describe('build execution identity', () => {
  it('T-PF6-I1 same semantic payload yields same runId', () => {
    const payload = {
      packetId: 'packet-1',
      bundleId: 'bundle-1',
      repoTarget: '.',
      executionPlan: {
        steps: [{
          stepId: 'step-a',
          operationType: 'generateFile' as const,
          targetPath: 'src/a.ts',
          promptTemplate: 'prompt',
          expectedArtifacts: ['sourceFile' as const],
        }],
      },
    };

    expect(deriveBuildExecutionRunId(payload)).toBe(deriveBuildExecutionRunId(payload));
  });

  it('T-PF6-I2 included field changes produce different runId', () => {
    const base = {
      packetId: 'packet-1',
      bundleId: 'bundle-1',
      repoTarget: '.',
      executionPlan: {
        steps: [{
          stepId: 'step-a',
          operationType: 'generateFile' as const,
          targetPath: 'src/a.ts',
          promptTemplate: 'prompt',
          expectedArtifacts: ['sourceFile' as const],
        }],
      },
    };

    const changed = {
      ...base,
      executionPlan: {
        steps: [{
          ...base.executionPlan.steps[0],
          targetPath: 'src/b.ts',
        }],
      },
    };

    expect(deriveBuildExecutionRunId(base)).not.toBe(deriveBuildExecutionRunId(changed));
  });

  it('T-PF6-I3 excluded fields do not affect runId', () => {
    const base = {
      packetId: 'packet-1',
      bundleId: 'bundle-1',
      repoTarget: '.',
      executionPlan: {
        steps: [{
          stepId: 'step-a',
          operationType: 'generateFile' as const,
          targetPath: 'src/a.ts',
          promptTemplate: 'prompt',
          expectedArtifacts: ['sourceFile' as const],
        }],
      },
    };

    const withRuntimeFields = {
      ...base,
      runId: 'runtime-id',
      status: 'running',
      generatedArtifacts: [{ artifactId: 'x' }],
      validationResults: [{ validationState: 'invalid' }],
    };

    expect(deriveBuildExecutionRunId(base)).toBe(deriveBuildExecutionRunId(withRuntimeFields));
  });
});
