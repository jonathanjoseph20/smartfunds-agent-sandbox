import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createExecutionContractHistoryStore,
  ensureExecutionContractArtifactDir,
  resolveExecutionContractArtifactPaths,
  type ExecutionContractHistoryStore,
} from './execution-contract-history-store.ts';
import {
  createExecutionContractProjection,
  type ExecutionContractProjectionEngine,
} from './execution-contract-projection.ts';
import type {
  ExecutionContractPreconditionResult,
  MissionExecutionContractHistory,
  MissionExecutionContractMaterializationSummary,
} from './execution-contract-types.ts';

function toMarkdownReport(input: {
  executionContractId: string;
  missionId: string;
  assignmentDecisionId: string;
  activationDecisionId: string;
  selectedTeamId: string;
  executionPolicyId: string;
  contractState: string;
  executionEligibilityState: string;
  executionTarget: string;
  remainingBlockers: string[];
  limitations: string[];
  preconditionResults: ExecutionContractPreconditionResult[];
}): string {
  const lines = [
    '# Mission Execution Contract Report',
    '',
    `Execution Contract: ${input.executionContractId}`,
    `Mission: ${input.missionId}`,
    `Assignment Decision: ${input.assignmentDecisionId}`,
    `Activation Decision: ${input.activationDecisionId}`,
    `Selected Team: ${input.selectedTeamId}`,
    `Policy: ${input.executionPolicyId}`,
    `Contract State: ${input.contractState}`,
    `Execution Eligibility State: ${input.executionEligibilityState}`,
    `Execution Target: ${input.executionTarget}`,
    '',
    '## Summary',
    `- preconditions: ${String(input.preconditionResults.length)}`,
    `- remainingBlockers: ${input.remainingBlockers.join(', ') || 'none'}`,
    `- limitations: ${input.limitations.join(', ') || 'none'}`,
    '',
    '## Preconditions',
  ];

  for (const precondition of input.preconditionResults) {
    lines.push(`- ${precondition.preconditionId} (${precondition.state})`);
  }

  lines.push('');
  lines.push('## Canonical JSON Payload');
  lines.push(canonicalStringify({
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    assignmentDecisionId: input.assignmentDecisionId,
    activationDecisionId: input.activationDecisionId,
    selectedTeamId: input.selectedTeamId,
    executionPolicyId: input.executionPolicyId,
    contractState: input.contractState,
    executionEligibilityState: input.executionEligibilityState,
    executionTarget: input.executionTarget,
    remainingBlockers: input.remainingBlockers,
    limitations: input.limitations,
    preconditionResults: input.preconditionResults,
  }));
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function appendMaterializationEvent(input: {
  missionId: string;
  executionContractId: string;
  historyStore: ExecutionContractHistoryStore;
}): MissionExecutionContractHistory {
  input.historyStore.append({
    executionContractId: input.executionContractId,
    missionId: input.missionId,
    eventType: 'execution_contract_materialized',
    reasoning: 'execution_contract_projection_materialized',
    payload: {
      missionId: input.missionId,
      executionContractId: input.executionContractId,
    },
  });

  return input.historyStore.load({
    executionContractId: input.executionContractId,
    missionId: input.missionId,
  });
}

export function createExecutionContractMaterializer(options: {
  projection?: ExecutionContractProjectionEngine;
  historyStore?: ExecutionContractHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createExecutionContractProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createExecutionContractHistoryStore({
    artifactsRoot: options.executionContractArtifactsRoot,
  });

  function materializeOne(input: {
    missionId: string;
    executionPolicyId?: string;
  }): MissionExecutionContractMaterializationSummary {
    const projectedInitial = projection.projectOne(input);

    ensureExecutionContractArtifactDir({
      executionContractId: projectedInitial.executionContractId,
      rootDir: options.executionContractArtifactsRoot,
    });

    const paths = resolveExecutionContractArtifactPaths({
      executionContractId: projectedInitial.executionContractId,
      rootDir: options.executionContractArtifactsRoot,
    });

    const history = appendMaterializationEvent({
      missionId: projectedInitial.missionId,
      executionContractId: projectedInitial.executionContractId,
      historyStore,
    });

    const projected = projection.projectOne(input);

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.preconditionsJsonPath, `${canonicalStringify(projected.preconditionResults)}\n`, 'utf8');
    fs.writeFileSync(paths.runtimeEnvelopeJsonPath, `${canonicalStringify(projected.runtimeEnvelopeStub)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      assignmentDecisionId: projected.assignmentDecisionId,
      activationDecisionId: projected.activationDecisionId,
      selectedTeamId: projected.selectedTeamId,
      executionPolicyId: projected.executionPolicyId,
      contractState: projected.contractState,
      executionEligibilityState: projected.executionEligibilityState,
      executionTarget: projected.executionTarget,
      remainingBlockers: projected.remainingBlockers,
      limitations: projected.limitations,
      preconditionResults: projected.preconditionResults,
    }), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');

    return {
      executionContractId: projected.executionContractId,
      missionId: projected.missionId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      preconditionsPath: paths.preconditionsJsonPath,
      runtimeEnvelopePath: paths.runtimeEnvelopeJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type ExecutionContractMaterializer = ReturnType<typeof createExecutionContractMaterializer>;
