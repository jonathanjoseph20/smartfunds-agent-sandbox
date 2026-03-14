import { describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../../finance/determinism.ts';
import { attestBuildEvidenceExecutionPlan } from '../../build-evidence/execution-plan-attestation.ts';

const run = {
  executionPlan: {
    steps: [{
      stepId: 'step-1',
      operationType: 'generateFile' as const,
      targetPath: 'src/a.ts',
      promptTemplate: 'prompt',
      expectedArtifacts: ['sourceFile' as const],
    }],
  },
};

const runHash = sha256(canonicalStringify({
  executionPlan: {
    steps: [{
      stepId: 'step-1',
      operationType: 'generateFile',
      targetPath: 'src/a.ts',
      promptTemplate: 'prompt',
      expectedArtifacts: ['sourceFile'],
    }],
  },
}));

describe('execution plan attestation', () => {
  it('T-PF7-E1 execution_plan_verified', () => {
    const result = attestBuildEvidenceExecutionPlan({
      bundle: {
        buildEvidenceBundleId: 'be-1',
        runId: 'run-1',
        executionPlanHash: runHash,
      },
      run,
      expectedExecutionPlanHash: runHash,
    });

    expect(result.attestationClass).toBe('execution_plan_verified');
  });

  it('T-PF7-E2 execution_plan_mismatch', () => {
    const result = attestBuildEvidenceExecutionPlan({
      bundle: {
        buildEvidenceBundleId: 'be-1',
        runId: 'run-1',
        executionPlanHash: 'different',
      },
      run,
      expectedExecutionPlanHash: runHash,
    });

    expect(result.attestationClass).toBe('execution_plan_mismatch');
  });

  it('T-PF7-E3 execution_plan_partial', () => {
    const result = attestBuildEvidenceExecutionPlan({
      bundle: {
        buildEvidenceBundleId: 'be-1',
        runId: 'run-1',
        executionPlanHash: runHash,
      },
      run,
      expectedExecutionPlanHash: 'missing-reference-hash',
    });

    expect(result.attestationClass).toBe('execution_plan_partial');
  });

  it('T-PF7-E4 execution_plan_inconclusive', () => {
    const result = attestBuildEvidenceExecutionPlan({
      bundle: {
        buildEvidenceBundleId: 'be-1',
        runId: 'run-1',
        executionPlanHash: runHash,
      },
      run: {
        executionPlan: {
          steps: [],
        },
      },
    });

    expect(result.attestationClass).toBe('execution_plan_inconclusive');
  });
});
