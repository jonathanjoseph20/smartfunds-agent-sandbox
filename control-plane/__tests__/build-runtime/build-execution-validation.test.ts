import { describe, expect, it } from 'vitest';

import { validateBuildExecutionRun } from '../../build-runtime/build-execution-validation.ts';

function baseRun() {
  return {
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
    generatedArtifacts: [],
    validationResults: [],
    status: 'draft',
  };
}

describe('build execution validation', () => {
  it('T-PF6-V1 missing packet fails validation', () => {
    const validation = validateBuildExecutionRun({
      run: baseRun(),
      packetManager: {
        getCodexExecutionPacket: () => {
          throw new Error('CODEX_EXECUTION_PACKET_NOT_FOUND');
        },
      },
      scaffoldManager: {
        getRepoScaffoldBundle: () => ({
          bundleId: 'bundle-1',
          packetId: 'packet-1',
          graphId: 'graph-1',
          taskId: 'task-1',
          repoTarget: '.',
        }),
      },
    });

    expect(validation.validationState).toBe('invalid');
    expect(validation.violations).toContain('packet_not_found:packet-1');
  });

  it('T-PF6-V2 missing bundle fails validation', () => {
    const validation = validateBuildExecutionRun({
      run: baseRun(),
      packetManager: {
        getCodexExecutionPacket: () => ({
          packetId: 'packet-1',
          graphId: 'graph-1',
          taskId: 'task-1',
          promptTemplate: 'prompt',
        }),
      },
      scaffoldManager: {
        getRepoScaffoldBundle: () => {
          throw new Error('REPO_SCAFFOLD_BUNDLE_NOT_FOUND');
        },
      },
    });

    expect(validation.validationState).toBe('invalid');
    expect(validation.violations).toContain('bundle_not_found:bundle-1');
  });

  it('T-PF6-V3 empty steps and invalid operation type are invalid', () => {
    const run = baseRun();
    run.executionPlan.steps = [
      {
        stepId: 'step-z',
        operationType: 'badOperation' as never,
        targetPath: 'src/a.ts',
        promptTemplate: 'prompt',
        expectedArtifacts: [],
      },
      {
        stepId: 'step-a',
        operationType: 'generateFile',
        targetPath: 'src/b.ts',
        promptTemplate: 'prompt',
        expectedArtifacts: ['sourceFile'],
      },
    ];

    const validation = validateBuildExecutionRun({
      run,
      packetManager: {
        getCodexExecutionPacket: () => ({
          packetId: 'packet-1',
          graphId: 'graph-1',
          taskId: 'task-1',
          promptTemplate: 'prompt',
        }),
      },
      scaffoldManager: {
        getRepoScaffoldBundle: () => ({
          bundleId: 'bundle-1',
          packetId: 'packet-1',
          graphId: 'graph-1',
          taskId: 'task-1',
          repoTarget: '.',
        }),
      },
    });

    expect(validation.validationState).toBe('invalid');
    expect(validation.violations).toContain('executionPlan_steps_not_deterministically_sorted');
    expect(validation.violations.some((entry) => entry.startsWith('step_invalid_operationType:'))).toBe(true);
    expect(validation.violations.some((entry) => entry.startsWith('step_expectedArtifacts_empty:'))).toBe(true);
  });

  it('T-PF6-V4 artifact expectation mismatch surfaces as violations', () => {
    const run = baseRun();
    run.generatedArtifacts = [{
      artifactId: 'art-1',
      artifactType: 'docFile',
      filePath: 'docs/a.md',
      contentHash: 'hash',
      contentSize: 10,
    }];

    const validation = validateBuildExecutionRun({
      run,
      packetManager: {
        getCodexExecutionPacket: () => ({
          packetId: 'packet-1',
          graphId: 'graph-1',
          taskId: 'task-1',
          promptTemplate: 'prompt',
        }),
      },
      scaffoldManager: {
        getRepoScaffoldBundle: () => ({
          bundleId: 'bundle-1',
          packetId: 'packet-1',
          graphId: 'graph-1',
          taskId: 'task-1',
          repoTarget: '.',
        }),
      },
    });

    expect(validation.validationState).toBe('invalid');
    expect(validation.violations).toContain('missing_expected_artifact_type:sourceFile');
  });
});
