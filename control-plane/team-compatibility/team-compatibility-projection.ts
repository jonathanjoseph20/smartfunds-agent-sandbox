import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createTeamCompatibilityEvaluator,
  type TeamCompatibilityEvaluator,
} from './team-compatibility-evaluator.ts';
import {
  createTeamCompatibilityHistoryStore,
  resolveTeamCompatibilityArtifactPaths,
  type TeamCompatibilityHistoryStore,
} from './team-compatibility-history-store.ts';
import type { TeamCompatibilityProjection } from './team-compatibility-types.ts';

function computeHistoryDigest(input: { entries: unknown[] }): string {
  return sha256(canonicalStringify(input.entries));
}

export function createTeamCompatibilityProjection(options: {
  evaluator?: TeamCompatibilityEvaluator;
  historyStore?: TeamCompatibilityHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  rulesetVersion?: string;
} = {}) {
  const evaluator = options.evaluator ?? createTeamCompatibilityEvaluator({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    rulesetVersion: options.rulesetVersion,
  });

  const historyStore = options.historyStore ?? createTeamCompatibilityHistoryStore({
    artifactsRoot: options.compatibilityArtifactsRoot,
  });

  function projectOne(missionId: string): TeamCompatibilityProjection {
    const evaluated = evaluator.evaluateMissionCompatibility(missionId);

    const history = historyStore.load({
      compatibilitySetId: evaluated.compatibilitySet.compatibilitySetId,
      missionId: evaluated.compatibilitySet.missionId,
    });

    const historyDigest = computeHistoryDigest({ entries: history.entries });
    const artifactPaths = resolveTeamCompatibilityArtifactPaths({
      compatibilitySetId: evaluated.compatibilitySet.compatibilitySetId,
      rootDir: options.compatibilityArtifactsRoot,
    });

    const statusPreview = {
      compatibilitySetId: evaluated.compatibilitySet.compatibilitySetId,
      missionId: evaluated.compatibilitySet.missionId,
      missionType: evaluated.compatibilitySet.missionType,
      ...(evaluated.compatibilitySet.templateId ? { templateId: evaluated.compatibilitySet.templateId } : {}),
      compatibilityState: evaluated.compatibilitySet.compatibilityState,
      supportedTeamCount: evaluated.compatibilitySet.supportedTeamCount,
      blockedTeamCount: evaluated.compatibilitySet.blockedTeamCount,
      manualReviewTeamCount: evaluated.compatibilitySet.manualReviewTeamCount,
      unsupportedTeamCount: evaluated.compatibilitySet.unsupportedTeamCount,
      limitations: evaluated.compatibilitySet.limitations,
      historyDigest,
    } as Record<string, unknown>;

    const reportPreview = {
      compatibilitySetId: evaluated.compatibilitySet.compatibilitySetId,
      missionId: evaluated.compatibilitySet.missionId,
      missionType: evaluated.compatibilitySet.missionType,
      ...(evaluated.compatibilitySet.templateId ? { templateId: evaluated.compatibilitySet.templateId } : {}),
      compatibilityState: evaluated.compatibilitySet.compatibilityState,
      supportedTeamCount: evaluated.compatibilitySet.supportedTeamCount,
      blockedTeamCount: evaluated.compatibilitySet.blockedTeamCount,
      manualReviewTeamCount: evaluated.compatibilitySet.manualReviewTeamCount,
      unsupportedTeamCount: evaluated.compatibilitySet.unsupportedTeamCount,
      limitations: evaluated.compatibilitySet.limitations,
      candidateTeams: evaluated.compatibilitySet.candidateTeams,
      history,
      historyDigest,
    } as Record<string, unknown>;

    return {
      compatibilitySetId: evaluated.compatibilitySet.compatibilitySetId,
      missionId: evaluated.compatibilitySet.missionId,
      missionType: evaluated.compatibilitySet.missionType,
      ...(evaluated.compatibilitySet.templateId ? { templateId: evaluated.compatibilitySet.templateId } : {}),
      compatibilityState: evaluated.compatibilitySet.compatibilityState,
      candidateTeams: evaluated.compatibilitySet.candidateTeams,
      supportedTeamCount: evaluated.compatibilitySet.supportedTeamCount,
      blockedTeamCount: evaluated.compatibilitySet.blockedTeamCount,
      manualReviewTeamCount: evaluated.compatibilitySet.manualReviewTeamCount,
      unsupportedTeamCount: evaluated.compatibilitySet.unsupportedTeamCount,
      limitations: evaluated.compatibilitySet.limitations,
      historyDigest,
      historySummary: {
        totalEvents: history.entries.length,
        ...(history.entries[history.entries.length - 1]
          ? { lastEventType: history.entries[history.entries.length - 1].eventType }
          : {}),
        ...(history.entries[history.entries.length - 1]
          ? { lastEventDedupeKey: history.entries[history.entries.length - 1].eventDedupeKey }
          : {}),
      },
      artifactPaths,
      statusPreview,
      reportPreview,
    };
  }

  function projectAll(): TeamCompatibilityProjection[] {
    return evaluator
      .evaluateAllMissionCompatibility()
      .map((entry) => projectOne(entry.compatibilitySet.missionId))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  return {
    projectOne,
    projectAll,
  };
}

export type TeamCompatibilityProjectionEngine = ReturnType<typeof createTeamCompatibilityProjection>;
