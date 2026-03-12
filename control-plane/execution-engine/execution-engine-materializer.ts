import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createExecutionEngineHistoryStore,
  ensureExecutionEngineArtifactDir,
  resolveExecutionEngineArtifactPaths,
  type ExecutionEngineHistoryStore,
} from './execution-engine-history-store.ts';
import {
  createExecutionEngineProjection,
  type ExecutionEngineProjectionEngine,
} from './execution-engine-projection.ts';
import type { MissionExecutionEngineMaterializationSummary } from './execution-engine-types.ts';

function toMarkdownReport(input: {
  executionEngineRunId: string;
  executionAttemptId: string;
  executionJournalId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  enginePolicyId: string;
  engineState: string;
  engineEligibilityState: string;
  runMode: string;
  blockingReasons: string[];
  limitations: string[];
}): string {
  const lines = [
    '# Mission Execution Engine Report',
    '',
    `Execution Engine Run: ${input.executionEngineRunId}`,
    `Execution Attempt: ${input.executionAttemptId}`,
    `Execution Journal: ${input.executionJournalId}`,
    `Runtime Envelope: ${input.runtimeEnvelopeId}`,
    `Execution Contract: ${input.executionContractId}`,
    `Mission: ${input.missionId}`,
    `Engine Policy: ${input.enginePolicyId}`,
    `Engine State: ${input.engineState}`,
    `Engine Eligibility State: ${input.engineEligibilityState}`,
    `Run Mode: ${input.runMode}`,
    '',
    '## Summary',
    `- blockingReasons: ${input.blockingReasons.join(', ') || 'none'}`,
    `- limitations: ${input.limitations.join(', ') || 'none'}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify({
      executionEngineRunId: input.executionEngineRunId,
      executionAttemptId: input.executionAttemptId,
      executionJournalId: input.executionJournalId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      enginePolicyId: input.enginePolicyId,
      engineState: input.engineState,
      engineEligibilityState: input.engineEligibilityState,
      runMode: input.runMode,
      blockingReasons: input.blockingReasons,
      limitations: input.limitations,
    }),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function createExecutionEngineMaterializer(options: {
  projection?: ExecutionEngineProjectionEngine;
  historyStore?: ExecutionEngineHistoryStore;
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
  executionJournalArtifactsRoot?: string;
  executionEngineArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createExecutionEngineProjection({
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
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createExecutionEngineHistoryStore({
    artifactsRoot: options.executionEngineArtifactsRoot,
  });

  function materializeOne(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
  }): MissionExecutionEngineMaterializationSummary {
    const projectedInitial = projection.projectOne(input);

    ensureExecutionEngineArtifactDir({
      executionEngineRunId: projectedInitial.executionEngineRunId,
      rootDir: options.executionEngineArtifactsRoot,
    });

    historyStore.append({
      executionEngineRunId: projectedInitial.executionEngineRunId,
      executionAttemptId: projectedInitial.executionAttemptId,
      executionJournalId: projectedInitial.executionJournalId,
      runtimeEnvelopeId: projectedInitial.runtimeEnvelopeId,
      executionContractId: projectedInitial.executionContractId,
      missionId: projectedInitial.missionId,
      eventType: 'engine_run_materialized',
      reasoning: 'execution_engine_projection_materialized',
      payload: {
        executionEngineRunId: projectedInitial.executionEngineRunId,
        executionAttemptId: projectedInitial.executionAttemptId,
      },
    });

    const projected = projection.projectOne(input);

    const paths = resolveExecutionEngineArtifactPaths({
      executionEngineRunId: projected.executionEngineRunId,
      rootDir: options.executionEngineArtifactsRoot,
    });

    const history = historyStore.load({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      executionJournalId: projected.executionJournalId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      executionJournalId: projected.executionJournalId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      enginePolicyId: projected.enginePolicyId,
      engineState: projected.engineState,
      engineEligibilityState: projected.engineEligibilityState,
      runMode: projected.runMode,
      blockingReasons: projected.blockingReasons,
      limitations: projected.limitations,
    }), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.outputsJsonPath, `${canonicalStringify(projected.runOutputs)}\n`, 'utf8');

    return {
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      executionJournalId: projected.executionJournalId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      outputsPath: paths.outputsJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type ExecutionEngineMaterializer = ReturnType<typeof createExecutionEngineMaterializer>;
