import { describe, expect, it } from 'vitest';

import {
  buildBuildExecutionStepPrompt,
  createBuildExecutionRunner,
} from '../../build-runtime/build-execution-runner.ts';

describe('build execution runner', () => {
  it('T-PF6-R1 prompt construction is deterministic', () => {
    const input = {
      packet: {
        packetId: 'packet-1',
        graphId: 'graph-1',
        taskId: 'task-1',
        promptTemplate: 'packet prompt',
      },
      bundle: {
        bundleId: 'bundle-1',
        repoTarget: '.',
        directories: ['src'],
        files: ['src/a.ts'],
        workspaceLayout: {
          root: '.',
          srcDir: 'src',
          testsDir: 'tests',
          configDir: 'config',
          docsDir: 'docs',
        },
      },
      step: {
        stepId: 'step-1',
        operationType: 'generateFile' as const,
        targetPath: 'src/a.ts',
        promptTemplate: 'step prompt',
        expectedArtifacts: ['sourceFile' as const],
      },
      run: {
        runId: 'run-1',
        packetId: 'packet-1',
        bundleId: 'bundle-1',
        graphId: 'graph-1',
        taskId: 'task-1',
        repoTarget: '.',
      },
    };

    const first = buildBuildExecutionStepPrompt(input);
    const second = buildBuildExecutionStepPrompt(input);

    expect(first.promptText).toBe(second.promptText);
    expect(first.promptPayload).toEqual(second.promptPayload);
  });

  it('T-PF6-R2 deterministic adapter yields stable artifacts and validation', () => {
    const runner = createBuildExecutionRunner();

    const result = runner.executeRun({
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
            promptTemplate: 'step prompt',
            expectedArtifacts: ['sourceFile'],
          }],
        },
        generatedArtifacts: [],
        validationResults: [],
        status: 'running',
      },
      packet: {
        packetId: 'packet-1',
        graphId: 'graph-1',
        taskId: 'task-1',
        taskName: 'Task',
        taskDescription: 'Desc',
        subsystem: 'api',
        phase: 'phase-1',
        dependencies: [],
        promptTemplate: 'packet prompt',
        expectedArtifacts: ['src/a.ts'],
        validationRules: ['rule'],
        status: 'ready',
      },
      bundle: {
        bundleId: 'bundle-1',
        packetId: 'packet-1',
        graphId: 'graph-1',
        taskId: 'task-1',
        repoTarget: '.',
        directories: ['src'],
        files: ['src/a.ts'],
        patchTargets: [],
        artifactDependencies: [],
        workspaceLayout: {
          root: '.',
          srcDir: 'src',
          testsDir: 'tests',
          configDir: 'config',
          docsDir: 'docs',
        },
        status: 'ready',
      },
    });

    expect(result.generatedArtifacts.length).toBe(1);
    expect(result.generatedArtifacts[0]!.artifactType).toBe('sourceFile');
    expect(result.generatedArtifacts[0]!.artifactId.length).toBeGreaterThan(10);
    expect(result.validation.validationState).toBe('valid');
    expect(result.stepResults).toEqual([
      {
        stepId: 'step-1',
        artifactIds: [result.generatedArtifacts[0]!.artifactId],
      },
    ]);
  });
});
