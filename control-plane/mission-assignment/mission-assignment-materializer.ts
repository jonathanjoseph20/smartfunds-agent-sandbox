import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createMissionAssignmentHistoryStore,
  ensureMissionAssignmentArtifactDir,
  resolveMissionAssignmentArtifactPaths,
  type MissionAssignmentHistoryStore,
} from './mission-assignment-history-store.ts';
import {
  createMissionAssignmentProjection,
  type MissionAssignmentProjectionEngine,
} from './mission-assignment-projection.ts';
import type {
  MissionAssignmentCandidate,
  MissionAssignmentHistory,
  MissionAssignmentMaterializationSummary,
} from './mission-assignment-types.ts';

function toMarkdownReport(input: {
  assignmentDecisionId: string;
  missionId: string;
  compatibilitySetId: string;
  assignmentPolicyId: string;
  assignmentMode: string;
  decisionState: string;
  selectedTeamId?: string;
  candidateTeams: MissionAssignmentCandidate[];
  alternativeTeams: string[];
  blockingReasons: string[];
  limitations: string[];
}): string {
  const lines = [
    '# Mission Assignment Report',
    '',
    `Assignment Decision: ${input.assignmentDecisionId}`,
    `Mission: ${input.missionId}`,
    `Compatibility Set: ${input.compatibilitySetId}`,
    `Policy: ${input.assignmentPolicyId}`,
    `Mode: ${input.assignmentMode}`,
    `State: ${input.decisionState}`,
    `Selected Team: ${input.selectedTeamId ?? 'none'}`,
    '',
    '## Summary',
    `- candidateTeams: ${String(input.candidateTeams.length)}`,
    `- alternativeTeams: ${input.alternativeTeams.join(', ') || 'none'}`,
    `- blockingReasons: ${input.blockingReasons.join(', ') || 'none'}`,
    `- limitations: ${input.limitations.join(', ') || 'none'}`,
    '',
    '## Ranked Candidates',
  ];

  for (const candidate of input.candidateTeams) {
    lines.push(
      `- #${String(candidate.assignmentRank)} ${candidate.teamId} (${candidate.compatibilityClass}/${candidate.assignmentReadiness}/${candidate.policyScoreClass})`,
    );
  }

  lines.push('');
  lines.push('## Canonical JSON Payload');
  lines.push(canonicalStringify({
    assignmentDecisionId: input.assignmentDecisionId,
    missionId: input.missionId,
    compatibilitySetId: input.compatibilitySetId,
    assignmentPolicyId: input.assignmentPolicyId,
    assignmentMode: input.assignmentMode,
    decisionState: input.decisionState,
    selectedTeamId: input.selectedTeamId ?? null,
    candidateTeams: input.candidateTeams,
    alternativeTeams: input.alternativeTeams,
    blockingReasons: input.blockingReasons,
    limitations: input.limitations,
  }));
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function appendMaterializationEvent(input: {
  missionId: string;
  assignmentDecisionId: string;
  historyStore: MissionAssignmentHistoryStore;
}): MissionAssignmentHistory {
  input.historyStore.append({
    assignmentDecisionId: input.assignmentDecisionId,
    missionId: input.missionId,
    eventType: 'assignment_materialized',
    reasoning: 'assignment_projection_materialized',
    payload: {
      missionId: input.missionId,
      assignmentDecisionId: input.assignmentDecisionId,
    },
  });

  return input.historyStore.load({
    assignmentDecisionId: input.assignmentDecisionId,
    missionId: input.missionId,
  });
}

export function createMissionAssignmentMaterializer(options: {
  projection?: MissionAssignmentProjectionEngine;
  historyStore?: MissionAssignmentHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createMissionAssignmentProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionAssignmentHistoryStore({
    artifactsRoot: options.assignmentArtifactsRoot,
  });

  function materializeOne(input: {
    missionId: string;
    assignmentPolicyId?: string;
  }): MissionAssignmentMaterializationSummary {
    const projectedInitial = projection.projectOne({
      missionId: input.missionId,
      assignmentPolicyId: input.assignmentPolicyId,
    });

    ensureMissionAssignmentArtifactDir({
      assignmentDecisionId: projectedInitial.assignmentDecisionId,
      rootDir: options.assignmentArtifactsRoot,
    });

    const paths = resolveMissionAssignmentArtifactPaths({
      assignmentDecisionId: projectedInitial.assignmentDecisionId,
      rootDir: options.assignmentArtifactsRoot,
    });

    const history = appendMaterializationEvent({
      missionId: projectedInitial.missionId,
      assignmentDecisionId: projectedInitial.assignmentDecisionId,
      historyStore,
    });

    const projected = projection.projectOne({
      missionId: input.missionId,
      assignmentPolicyId: input.assignmentPolicyId,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.candidatesJsonPath, `${canonicalStringify(projected.candidateTeams)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      assignmentDecisionId: projected.assignmentDecisionId,
      missionId: projected.missionId,
      compatibilitySetId: projected.compatibilitySetId,
      assignmentPolicyId: projected.assignmentPolicyId,
      assignmentMode: projected.assignmentMode,
      decisionState: projected.decisionState,
      selectedTeamId: projected.selectedTeamId,
      candidateTeams: projected.candidateTeams,
      alternativeTeams: projected.alternativeTeams,
      blockingReasons: projected.blockingReasons,
      limitations: projected.limitations,
    }), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');

    return {
      assignmentDecisionId: projected.assignmentDecisionId,
      missionId: projected.missionId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      candidatesPath: paths.candidatesJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type MissionAssignmentMaterializer = ReturnType<typeof createMissionAssignmentMaterializer>;
