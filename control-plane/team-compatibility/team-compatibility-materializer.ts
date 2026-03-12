import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createTeamCompatibilityHistoryStore,
  ensureTeamCompatibilityArtifactDir,
  resolveTeamCompatibilityArtifactPaths,
  type TeamCompatibilityHistoryStore,
} from './team-compatibility-history-store.ts';
import {
  createTeamCompatibilityProjection,
  type TeamCompatibilityProjectionEngine,
} from './team-compatibility-projection.ts';
import type {
  MissionTeamCompatibilityCandidate,
  TeamCompatibilityHistory,
  TeamCompatibilityMaterializationSummary,
} from './team-compatibility-types.ts';

function toMarkdownReport(input: {
  missionId: string;
  missionType: string;
  templateId?: string;
  compatibilityState: string;
  candidateTeams: MissionTeamCompatibilityCandidate[];
  limitations: string[];
}): string {
  const lines = [
    '# Team Compatibility Report',
    '',
    `Mission: ${input.missionId}`,
    `Mission Type: ${input.missionType}`,
    `Template: ${input.templateId ?? 'none'}`,
    `Compatibility State: ${input.compatibilityState}`,
    '',
    '## Summary',
    `- candidates: ${String(input.candidateTeams.length)}`,
    `- limitations: ${input.limitations.join(', ') || 'none'}`,
    '',
    '## Candidate Teams',
  ];

  for (const candidate of input.candidateTeams) {
    lines.push(`- ${candidate.teamId}: ${candidate.compatibilityClass} / ${candidate.assignmentReadiness}`);
  }

  lines.push('');
  lines.push('## Canonical JSON Payload');
  lines.push(canonicalStringify({
    missionId: input.missionId,
    missionType: input.missionType,
    templateId: input.templateId ?? null,
    compatibilityState: input.compatibilityState,
    candidateTeams: input.candidateTeams,
    limitations: input.limitations,
  }));
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePreviousCandidates(reportPath: string): MissionTeamCompatibilityCandidate[] {
  if (!fs.existsSync(reportPath)) {
    return [];
  }

  const raw = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as unknown;
  if (!isRecord(raw) || !Array.isArray(raw.candidateTeams)) {
    return [];
  }

  return raw.candidateTeams
    .filter((entry): entry is MissionTeamCompatibilityCandidate => isRecord(entry) && typeof entry.teamId === 'string')
    .map((entry) => entry as MissionTeamCompatibilityCandidate)
    .sort((left, right) => left.teamId.localeCompare(right.teamId));
}

function appendEvaluationEvents(input: {
  missionId: string;
  compatibilitySetId: string;
  previousCandidates: MissionTeamCompatibilityCandidate[];
  nextCandidates: MissionTeamCompatibilityCandidate[];
  historyStore: TeamCompatibilityHistoryStore;
}): TeamCompatibilityHistory {
  const previousByTeam = new Map(input.previousCandidates.map((entry) => [entry.teamId, entry]));
  const nextByTeam = new Map(input.nextCandidates.map((entry) => [entry.teamId, entry]));

  input.historyStore.append({
    compatibilitySetId: input.compatibilitySetId,
    missionId: input.missionId,
    eventType: 'compatibility_evaluated',
    reasoning: 'mission_team_compatibility_evaluated',
    payload: {
      missionId: input.missionId,
      compatibilitySetId: input.compatibilitySetId,
      candidateTeamIds: input.nextCandidates.map((entry) => entry.teamId),
    },
  });

  for (const candidate of input.nextCandidates) {
    if (!previousByTeam.has(candidate.teamId)) {
      input.historyStore.append({
        compatibilitySetId: input.compatibilitySetId,
        missionId: input.missionId,
        eventType: 'candidate_added',
        reasoning: 'candidate_added_to_compatibility_set',
        payload: {
          teamId: candidate.teamId,
          compatibilityClass: candidate.compatibilityClass,
          assignmentReadiness: candidate.assignmentReadiness,
        },
      });
    }
  }

  for (const candidate of input.previousCandidates) {
    if (!nextByTeam.has(candidate.teamId)) {
      input.historyStore.append({
        compatibilitySetId: input.compatibilitySetId,
        missionId: input.missionId,
        eventType: 'candidate_removed',
        reasoning: 'candidate_removed_from_compatibility_set',
        payload: {
          teamId: candidate.teamId,
          compatibilityClass: candidate.compatibilityClass,
          assignmentReadiness: candidate.assignmentReadiness,
        },
      });
    }
  }

  for (const candidate of input.nextCandidates) {
    const previous = previousByTeam.get(candidate.teamId);
    if (!previous) {
      continue;
    }

    if (
      previous.compatibilityClass !== candidate.compatibilityClass
      || previous.assignmentReadiness !== candidate.assignmentReadiness
    ) {
      input.historyStore.append({
        compatibilitySetId: input.compatibilitySetId,
        missionId: input.missionId,
        eventType: 'candidate_state_changed',
        reasoning: 'candidate_compatibility_state_changed',
        payload: {
          teamId: candidate.teamId,
          previousCompatibilityClass: previous.compatibilityClass,
          nextCompatibilityClass: candidate.compatibilityClass,
          previousAssignmentReadiness: previous.assignmentReadiness,
          nextAssignmentReadiness: candidate.assignmentReadiness,
        },
      });
    }
  }

  input.historyStore.append({
    compatibilitySetId: input.compatibilitySetId,
    missionId: input.missionId,
    eventType: 'compatibility_materialized',
    reasoning: 'compatibility_projection_materialized',
    payload: {
      missionId: input.missionId,
      compatibilitySetId: input.compatibilitySetId,
    },
  });

  return input.historyStore.load({
    compatibilitySetId: input.compatibilitySetId,
    missionId: input.missionId,
  });
}

export function createTeamCompatibilityMaterializer(options: {
  projection?: TeamCompatibilityProjectionEngine;
  historyStore?: TeamCompatibilityHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  rulesetVersion?: string;
} = {}) {
  const projection = options.projection ?? createTeamCompatibilityProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    rulesetVersion: options.rulesetVersion,
  });

  const historyStore = options.historyStore ?? createTeamCompatibilityHistoryStore({
    artifactsRoot: options.compatibilityArtifactsRoot,
  });

  function materializeProjection(input: { missionId: string }): TeamCompatibilityMaterializationSummary {
    const projectedInitial = projection.projectOne(input.missionId);

    ensureTeamCompatibilityArtifactDir({
      compatibilitySetId: projectedInitial.compatibilitySetId,
      rootDir: options.compatibilityArtifactsRoot,
    });

    const paths = resolveTeamCompatibilityArtifactPaths({
      compatibilitySetId: projectedInitial.compatibilitySetId,
      rootDir: options.compatibilityArtifactsRoot,
    });

    const previousCandidates = parsePreviousCandidates(paths.reportJsonPath);
    appendEvaluationEvents({
      missionId: projectedInitial.missionId,
      compatibilitySetId: projectedInitial.compatibilitySetId,
      previousCandidates,
      nextCandidates: projectedInitial.candidateTeams,
      historyStore,
    });

    const projected = projection.projectOne(input.missionId);
    const history = historyStore.load({
      compatibilitySetId: projected.compatibilitySetId,
      missionId: projected.missionId,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      missionId: projected.missionId,
      missionType: projected.missionType,
      templateId: projected.templateId,
      compatibilityState: projected.compatibilityState,
      candidateTeams: projected.candidateTeams,
      limitations: projected.limitations,
    }), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');

    return {
      compatibilitySetId: projected.compatibilitySetId,
      missionId: projected.missionId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
    };
  }

  function materializeOne(missionId: string): TeamCompatibilityMaterializationSummary {
    return materializeProjection({ missionId });
  }

  return {
    materializeProjection,
    materializeOne,
  };
}

export type TeamCompatibilityMaterializer = ReturnType<typeof createTeamCompatibilityMaterializer>;
