import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createExecutionAttemptHistoryStore,
  ensureExecutionAttemptArtifactDir,
  resolveExecutionAttemptArtifactPaths,
  type ExecutionAttemptHistoryStore,
} from './execution-attempt-history-store.ts';
import {
  createExecutionAttemptProjection,
  type ExecutionAttemptProjectionEngine,
} from './execution-attempt-projection.ts';
import type {
  MissionExecutionAttemptHistory,
  MissionExecutionAttemptMaterializationSummary,
} from './execution-attempt-types.ts';

function toMarkdownReport(input: {
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  attemptIndex: number;
  attemptState: string;
  attemptLifecycleState: string;
  blockers: string[];
  limitations: string[];
}): string {
  const lines = [
    '# Mission Execution Attempt Report',
    '',
    `Execution Attempt: ${input.executionAttemptId}`,
    `Runtime Envelope: ${input.runtimeEnvelopeId}`,
    `Execution Contract: ${input.executionContractId}`,
    `Mission: ${input.missionId}`,
    `Attempt Index: ${input.attemptIndex}`,
    `Attempt State: ${input.attemptState}`,
    `Attempt Lifecycle State: ${input.attemptLifecycleState}`,
    '',
    '## Summary',
    `- blockers: ${input.blockers.join(', ') || 'none'}`,
    `- limitations: ${input.limitations.join(', ') || 'none'}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify({
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      attemptIndex: input.attemptIndex,
      attemptState: input.attemptState,
      attemptLifecycleState: input.attemptLifecycleState,
      blockers: input.blockers,
      limitations: input.limitations,
    }),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function appendMaterializationEvent(input: {
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  historyStore: ExecutionAttemptHistoryStore;
}): MissionExecutionAttemptHistory {
  input.historyStore.append({
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: 'execution_attempt_materialized',
    reasoning: 'execution_attempt_projection_materialized',
    payload: {
      executionAttemptId: input.executionAttemptId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
    },
  });

  return input.historyStore.load({
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    missionId: input.missionId,
  });
}

export function createExecutionAttemptMaterializer(options: {
  projection?: ExecutionAttemptProjectionEngine;
  historyStore?: ExecutionAttemptHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
  executionAttemptArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createExecutionAttemptProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createExecutionAttemptHistoryStore({
    artifactsRoot: options.executionAttemptArtifactsRoot,
  });

  function materializeOne(input: {
    executionAttemptId: string;
    runtimeEnvelopePolicyId?: string;
  }): MissionExecutionAttemptMaterializationSummary {
    const projectedInitial = projection.projectOne(input);

    ensureExecutionAttemptArtifactDir({
      executionAttemptId: projectedInitial.executionAttemptId,
      rootDir: options.executionAttemptArtifactsRoot,
    });

    const paths = resolveExecutionAttemptArtifactPaths({
      executionAttemptId: projectedInitial.executionAttemptId,
      rootDir: options.executionAttemptArtifactsRoot,
    });

    const history = appendMaterializationEvent({
      executionAttemptId: projectedInitial.executionAttemptId,
      runtimeEnvelopeId: projectedInitial.runtimeEnvelopeId,
      executionContractId: projectedInitial.executionContractId,
      missionId: projectedInitial.missionId,
      historyStore,
    });

    const projected = projection.projectOne(input);

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      attemptIndex: projected.attemptIndex,
      attemptState: projected.attemptState,
      attemptLifecycleState: projected.attemptLifecycleState,
      blockers: projected.blockers,
      limitations: projected.limitations,
    }), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.inputsJsonPath, `${canonicalStringify(projected.attemptInputs)}\n`, 'utf8');
    fs.writeFileSync(paths.capabilitiesJsonPath, `${canonicalStringify(projected.attemptCapabilities)}\n`, 'utf8');

    return {
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      inputsPath: paths.inputsJsonPath,
      capabilitiesPath: paths.capabilitiesJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type ExecutionAttemptMaterializer = ReturnType<typeof createExecutionAttemptMaterializer>;
