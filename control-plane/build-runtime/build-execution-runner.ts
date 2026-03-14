import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import type { CodexExecutionPacket } from '../codex/codex-execution-packet-types.ts';
import type { RepositoryScaffoldBundle } from '../repo-scaffold/repo-scaffold-types.ts';

import {
  normalizeGeneratedOutputs,
  toGeneratedArtifacts,
  validateExpectedArtifacts,
  type NormalizedGeneratedOutput,
} from './build-execution-artifacts.ts';
import type {
  ArtifactType,
  BuildExecutionRun,
  ExecutionStep,
  GeneratedArtifact,
  ValidationResult,
} from './build-execution-types.ts';

export type BuildExecutionAdapterStepInput = {
  runId: string;
  packetId: string;
  bundleId: string;
  graphId: string;
  taskId: string;
  repoTarget: string;
  step: ExecutionStep;
  promptPayload: Record<string, unknown>;
};

export type BuildExecutionAdapterStepOutput = {
  outputs: Array<{
    artifactType?: ArtifactType;
    filePath: string;
    content: string;
  }>;
  logs?: string[];
};

export interface BuildExecutionAdapter {
  executeStep(input: BuildExecutionAdapterStepInput): BuildExecutionAdapterStepOutput;
}

function toStableContext(input: {
  packet: Pick<CodexExecutionPacket, 'packetId' | 'graphId' | 'taskId' | 'promptTemplate'>;
  bundle: Pick<RepositoryScaffoldBundle, 'bundleId' | 'repoTarget' | 'directories' | 'files' | 'workspaceLayout'>;
  step: ExecutionStep;
  run: Pick<BuildExecutionRun, 'runId' | 'packetId' | 'bundleId' | 'graphId' | 'taskId' | 'repoTarget'>;
}): Record<string, unknown> {
  return {
    runId: input.run.runId,
    packetId: input.run.packetId,
    bundleId: input.run.bundleId,
    graphId: input.run.graphId,
    taskId: input.run.taskId,
    repoTarget: input.run.repoTarget,
    packetPromptTemplate: input.packet.promptTemplate,
    stepPromptTemplate: input.step.promptTemplate,
    stepId: input.step.stepId,
    operationType: input.step.operationType,
    targetPath: input.step.targetPath,
    expectedArtifacts: [...input.step.expectedArtifacts].sort((left, right) => left.localeCompare(right)),
    scaffoldContext: {
      repoTarget: input.bundle.repoTarget,
      directories: [...input.bundle.directories].sort((left, right) => left.localeCompare(right)),
      files: [...input.bundle.files].sort((left, right) => left.localeCompare(right)),
      workspaceLayout: input.bundle.workspaceLayout,
    },
  };
}

export function buildBuildExecutionStepPrompt(input: {
  packet: Pick<CodexExecutionPacket, 'packetId' | 'graphId' | 'taskId' | 'promptTemplate'>;
  bundle: Pick<RepositoryScaffoldBundle, 'bundleId' | 'repoTarget' | 'directories' | 'files' | 'workspaceLayout'>;
  step: ExecutionStep;
  run: Pick<BuildExecutionRun, 'runId' | 'packetId' | 'bundleId' | 'graphId' | 'taskId' | 'repoTarget'>;
}): {
  promptText: string;
  promptPayload: Record<string, unknown>;
} {
  const promptPayload = toStableContext(input);

  const promptText = [
    `# Build Execution Step ${input.step.stepId}`,
    '',
    '## Packet Prompt Template',
    input.packet.promptTemplate,
    '',
    '## Step Prompt Template',
    input.step.promptTemplate,
    '',
    '## Deterministic Prompt Payload',
    canonicalStringify(promptPayload),
    '',
  ].join('\n');

  return {
    promptText,
    promptPayload,
  };
}

export class DeterministicBuildExecutionAdapter implements BuildExecutionAdapter {
  executeStep(input: BuildExecutionAdapterStepInput): BuildExecutionAdapterStepOutput {
    const promptHash = sha256(canonicalStringify(input.promptPayload));

    const outputs = [...input.step.expectedArtifacts]
      .sort((left, right) => left.localeCompare(right))
      .map((artifactType, index) => ({
        artifactType,
        filePath: this.resolveArtifactPath(input.step.targetPath, artifactType, index),
        content: this.renderArtifactContent({
          artifactType,
          filePath: input.step.targetPath,
          promptHash,
          runId: input.runId,
          stepId: input.step.stepId,
          packetId: input.packetId,
          bundleId: input.bundleId,
        }),
      }));

    return {
      outputs,
      logs: [`step_prompt_hash:${promptHash}`],
    };
  }

  private resolveArtifactPath(basePath: string, artifactType: ArtifactType, index: number): string {
    if (index === 0) {
      return basePath;
    }

    if (artifactType === 'patch') {
      return `${basePath}.${artifactType}.patch`;
    }

    return `${basePath}.${artifactType}`;
  }

  private renderArtifactContent(input: {
    artifactType: ArtifactType;
    filePath: string;
    promptHash: string;
    runId: string;
    stepId: string;
    packetId: string;
    bundleId: string;
  }): string {
    return [
      '# Deterministic Build Execution Artifact',
      `artifactType: ${input.artifactType}`,
      `filePath: ${input.filePath}`,
      `promptHash: ${input.promptHash}`,
      `runId: ${input.runId}`,
      `stepId: ${input.stepId}`,
      `packetId: ${input.packetId}`,
      `bundleId: ${input.bundleId}`,
      '',
    ].join('\n');
  }
}

export function createBuildExecutionRunner(options: {
  adapter?: BuildExecutionAdapter;
} = {}) {
  const adapter = options.adapter ?? new DeterministicBuildExecutionAdapter();

  function executeRun(input: {
    run: BuildExecutionRun;
    packet: CodexExecutionPacket;
    bundle: RepositoryScaffoldBundle;
  }): {
    generatedArtifacts: GeneratedArtifact[];
    validation: ValidationResult;
    stepResults: Array<{ stepId: string; artifactIds: string[] }>;
    executionLogs: string[];
  } {
    const allOutputs: NormalizedGeneratedOutput[] = [];
    const stepResults: Array<{ stepId: string; artifactIds: string[] }> = [];
    const executionLogs: string[] = [];

    const steps = [...input.run.executionPlan.steps].sort((left, right) => left.stepId.localeCompare(right.stepId));

    for (const step of steps) {
      const prompt = buildBuildExecutionStepPrompt({
        packet: input.packet,
        bundle: input.bundle,
        step,
        run: input.run,
      });

      const stepOutput = adapter.executeStep({
        runId: input.run.runId,
        packetId: input.run.packetId,
        bundleId: input.run.bundleId,
        graphId: input.run.graphId,
        taskId: input.run.taskId,
        repoTarget: input.run.repoTarget,
        step,
        promptPayload: prompt.promptPayload,
      });

      const normalized = normalizeGeneratedOutputs(stepOutput.outputs);
      const artifacts = toGeneratedArtifacts(normalized);

      allOutputs.push(...normalized);
      stepResults.push({
        stepId: step.stepId,
        artifactIds: artifacts.map((artifact) => artifact.artifactId).sort((left, right) => left.localeCompare(right)),
      });

      executionLogs.push(`step:${step.stepId}`);
      if (stepOutput.logs) {
        executionLogs.push(...stepOutput.logs.sort((left, right) => left.localeCompare(right)));
      }
    }

    const generatedArtifacts = toGeneratedArtifacts(normalizeGeneratedOutputs(allOutputs));
    const validation = validateExpectedArtifacts({
      steps,
      generatedArtifacts,
    });

    return {
      generatedArtifacts,
      validation,
      stepResults: stepResults.sort((left, right) => left.stepId.localeCompare(right.stepId)),
      executionLogs: executionLogs,
    };
  }

  return {
    executeRun,
  };
}

export type BuildExecutionRunner = ReturnType<typeof createBuildExecutionRunner>;
