import { describe, expect, it } from 'vitest';

import { verifyArtifactsForBuildEvidence } from '../../build-evidence/artifact-verification.ts';

describe('artifact verification', () => {
  it('T-PF7-A1 artifact_hash_verified path', () => {
    const result = verifyArtifactsForBuildEvidence({
      buildEvidenceBundleId: 'be-1',
      run: {
        executionPlan: {
          steps: [{
            stepId: 'step-1',
            operationType: 'generateFile',
            targetPath: 'src/a.ts',
            promptTemplate: 'p',
            expectedArtifacts: ['sourceFile'],
          }],
        },
        generatedArtifacts: [{
          artifactId: 'artifact-1',
          artifactType: 'sourceFile',
          filePath: 'src/a.ts',
          contentHash: 'h1',
          contentSize: 10,
        }],
      },
      expectedArtifactHashes: {
        'src/a.ts::sourceFile': 'h1',
      },
    });

    expect(result[0]?.verificationClass).toBe('artifact_hash_verified');
  });

  it('T-PF7-A2 artifact_hash_mismatch path', () => {
    const result = verifyArtifactsForBuildEvidence({
      buildEvidenceBundleId: 'be-1',
      run: {
        executionPlan: {
          steps: [{
            stepId: 'step-1',
            operationType: 'generateFile',
            targetPath: 'src/a.ts',
            promptTemplate: 'p',
            expectedArtifacts: ['sourceFile'],
          }],
        },
        generatedArtifacts: [{
          artifactId: 'artifact-1',
          artifactType: 'sourceFile',
          filePath: 'src/a.ts',
          contentHash: 'h2',
          contentSize: 10,
        }],
      },
      expectedArtifactHashes: {
        'src/a.ts::sourceFile': 'h1',
      },
    });

    expect(result[0]?.verificationClass).toBe('artifact_hash_mismatch');
  });

  it('T-PF7-A3 artifact_missing path', () => {
    const result = verifyArtifactsForBuildEvidence({
      buildEvidenceBundleId: 'be-1',
      run: {
        executionPlan: {
          steps: [{
            stepId: 'step-1',
            operationType: 'generateFile',
            targetPath: 'src/a.ts',
            promptTemplate: 'p',
            expectedArtifacts: ['sourceFile'],
          }],
        },
        generatedArtifacts: [],
      },
      expectedArtifactHashes: {
        'src/a.ts::sourceFile': 'h1',
      },
    });

    expect(result.some((entry) => entry.verificationClass === 'artifact_missing')).toBe(true);
  });

  it('T-PF7-A4 artifact_unexpected path', () => {
    const result = verifyArtifactsForBuildEvidence({
      buildEvidenceBundleId: 'be-1',
      run: {
        executionPlan: {
          steps: [],
        },
        generatedArtifacts: [{
          artifactId: 'artifact-1',
          artifactType: 'sourceFile',
          filePath: 'src/extra.ts',
          contentHash: 'h2',
          contentSize: 10,
        }],
      },
      expectedArtifactHashes: {},
    });

    expect(result.some((entry) => entry.verificationClass === 'artifact_unexpected')).toBe(true);
  });

  it('T-PF7-A5 artifact_inconclusive path', () => {
    const result = verifyArtifactsForBuildEvidence({
      buildEvidenceBundleId: 'be-1',
      run: {
        executionPlan: {
          steps: [{
            stepId: 'step-1',
            operationType: 'generateFile',
            targetPath: 'src/a.ts',
            promptTemplate: 'p',
            expectedArtifacts: ['sourceFile'],
          }],
        },
        generatedArtifacts: [{
          artifactId: 'artifact-1',
          artifactType: 'sourceFile',
          filePath: 'src/a.ts',
          contentHash: 'h1',
          contentSize: 10,
        }],
      },
    });

    expect(result[0]?.verificationClass).toBe('artifact_inconclusive');
  });
});
