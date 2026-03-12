import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionActivationHistoryStore,
  ensureMissionActivationArtifactDir,
  resolveMissionActivationArtifactPaths,
  type MissionActivationHistoryStore,
} from './mission-activation-history-store.ts';
import {
  createMissionActivationProjection,
  type MissionActivationProjectionEngine,
} from './mission-activation-projection.ts';
import type {
  ActivationPreconditionResult,
  MissionActivationHistory,
  MissionActivationMaterializationSummary,
} from './mission-activation-types.ts';

function toMarkdownReport(input: {
  activationDecisionId: string;
  missionId: string;
  assignmentDecisionId: string;
  selectedTeamId: string;
  activationPolicyId: string;
  activationMode: string;
  activationState: string;
  executionReadinessState: string;
  blockingReasons: string[];
  limitations: string[];
  preconditionResults: ActivationPreconditionResult[];
}): string {
  const lines = [
    '# Mission Activation Report',
    '',
    `Activation Decision: ${input.activationDecisionId}`,
    `Mission: ${input.missionId}`,
    `Assignment Decision: ${input.assignmentDecisionId}`,
    `Selected Team: ${input.selectedTeamId}`,
    `Policy: ${input.activationPolicyId}`,
    `Mode: ${input.activationMode}`,
    `Activation State: ${input.activationState}`,
    `Execution Readiness State: ${input.executionReadinessState}`,
    '',
    '## Summary',
    `- preconditions: ${String(input.preconditionResults.length)}`,
    `- blockingReasons: ${input.blockingReasons.join(', ') || 'none'}`,
    `- limitations: ${input.limitations.join(', ') || 'none'}`,
    '',
    '## Preconditions',
  ];

  for (const precondition of input.preconditionResults) {
    lines.push(`- ${precondition.category} (${precondition.state})`);
  }

  lines.push('');
  lines.push('## Canonical JSON Payload');
  lines.push(canonicalStringify({
    activationDecisionId: input.activationDecisionId,
    missionId: input.missionId,
    assignmentDecisionId: input.assignmentDecisionId,
    selectedTeamId: input.selectedTeamId,
    activationPolicyId: input.activationPolicyId,
    activationMode: input.activationMode,
    activationState: input.activationState,
    executionReadinessState: input.executionReadinessState,
    blockingReasons: input.blockingReasons,
    limitations: input.limitations,
    preconditionResults: input.preconditionResults,
  }));
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function appendMaterializationEvent(input: {
  missionId: string;
  activationDecisionId: string;
  historyStore: MissionActivationHistoryStore;
}): MissionActivationHistory {
  input.historyStore.append({
    activationDecisionId: input.activationDecisionId,
    missionId: input.missionId,
    eventType: 'activation_materialized',
    reasoning: 'activation_projection_materialized',
    payload: {
      missionId: input.missionId,
      activationDecisionId: input.activationDecisionId,
    },
  });

  return input.historyStore.load({
    activationDecisionId: input.activationDecisionId,
    missionId: input.missionId,
  });
}

export function createMissionActivationMaterializer(options: {
  projection?: MissionActivationProjectionEngine;
  historyStore?: MissionActivationHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  dagDefinitionsDir?: string;
  missionDAGArtifactsRoot?: string;
  activationArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createMissionActivationProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    dagDefinitionsDir: options.dagDefinitionsDir,
    missionDAGArtifactsRoot: options.missionDAGArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionActivationHistoryStore({
    artifactsRoot: options.activationArtifactsRoot,
  });

  function materializeOne(input: {
    missionId: string;
    activationPolicyId?: string;
  }): MissionActivationMaterializationSummary {
    const projectedInitial = projection.projectOne(input);

    ensureMissionActivationArtifactDir({
      activationDecisionId: projectedInitial.activationDecisionId,
      rootDir: options.activationArtifactsRoot,
    });

    const paths = resolveMissionActivationArtifactPaths({
      activationDecisionId: projectedInitial.activationDecisionId,
      rootDir: options.activationArtifactsRoot,
    });

    const history = appendMaterializationEvent({
      missionId: projectedInitial.missionId,
      activationDecisionId: projectedInitial.activationDecisionId,
      historyStore,
    });

    const projected = projection.projectOne(input);

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.preconditionsJsonPath, `${canonicalStringify(projected.preconditionResults)}\n`, 'utf8');
    fs.writeFileSync(paths.handoffJsonPath, `${canonicalStringify(projected.handoffContract)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      activationDecisionId: projected.activationDecisionId,
      missionId: projected.missionId,
      assignmentDecisionId: projected.assignmentDecisionId,
      selectedTeamId: projected.selectedTeamId,
      activationPolicyId: projected.activationPolicyId,
      activationMode: projected.activationMode,
      activationState: projected.activationState,
      executionReadinessState: projected.executionReadinessState,
      blockingReasons: projected.blockingReasons,
      limitations: projected.limitations,
      preconditionResults: projected.preconditionResults,
    }), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');

    return {
      activationDecisionId: projected.activationDecisionId,
      missionId: projected.missionId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      preconditionsPath: paths.preconditionsJsonPath,
      handoffPath: paths.handoffJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type MissionActivationMaterializer = ReturnType<typeof createMissionActivationMaterializer>;
