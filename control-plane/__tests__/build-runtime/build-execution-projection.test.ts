import { describe, expect, it } from 'vitest';

import { projectBuildExecutionRun } from '../../build-runtime/build-execution-projection.ts';

describe('build execution projection', () => {
  it('T-PF6-P1 combines run, history, validation, and artifact summaries deterministically', () => {
    const projection = projectBuildExecutionRun({
      run: {
        runId: 'run-1',
        packetId: 'packet-1',
        bundleId: 'bundle-1',
        graphId: 'graph-1',
        taskId: 'task-1',
        repoTarget: '.',
        executionPlan: {
          steps: [{
            stepId: 'step-1',
            operationType: 'generateFile',
            targetPath: 'src/a.ts',
            promptTemplate: 'prompt',
            expectedArtifacts: ['sourceFile'],
          }],
        },
        generatedArtifacts: [{
          artifactId: 'art-1',
          artifactType: 'sourceFile',
          filePath: 'src/a.ts',
          contentHash: 'hash',
          contentSize: 5,
        }],
        validationResults: [],
        status: 'ready',
      },
      validation: {
        validationState: 'valid',
        missingFields: [],
        violations: [],
        warnings: [],
      },
      history: [{
        runId: 'run-1',
        eventType: 'build_execution_created',
        payloadHash: 'aaa',
        payload: {},
      }],
    });

    expect(projection.runId).toBe('run-1');
    expect(projection.executionSteps).toBe(1);
    expect(projection.artifactCount).toBe(1);
    expect(projection.validationState).toBe('valid');
    expect(projection.historySummary.totalEvents).toBe(1);
  });
});
