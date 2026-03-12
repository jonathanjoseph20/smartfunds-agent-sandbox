import {
  createTeamCompatibilityEvaluator,
  type TeamCompatibilityEvaluator,
} from './team-compatibility-evaluator.ts';
import {
  createTeamCompatibilityHistoryStore,
  type TeamCompatibilityHistoryStore,
} from './team-compatibility-history-store.ts';
import {
  createTeamCompatibilityMaterializer,
  type TeamCompatibilityMaterializer,
} from './team-compatibility-materializer.ts';
import {
  createTeamCompatibilityProjection,
  type TeamCompatibilityProjectionEngine,
} from './team-compatibility-projection.ts';
import type {
  MissionCompatibilityStatusSummary,
  MissionTeamCompatibilityCandidate,
} from './team-compatibility-types.ts';

export function createTeamCompatibilityInspection(options: {
  evaluator?: TeamCompatibilityEvaluator;
  projection?: TeamCompatibilityProjectionEngine;
  materializer?: TeamCompatibilityMaterializer;
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

  const projection = options.projection ?? createTeamCompatibilityProjection({
    evaluator,
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    rulesetVersion: options.rulesetVersion,
  });

  const materializer = options.materializer ?? createTeamCompatibilityMaterializer({
    projection,
    historyStore,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    rulesetVersion: options.rulesetVersion,
  });

  function listCompatibilitySets(): MissionCompatibilityStatusSummary[] {
    return projection
      .projectAll()
      .map((entry) => ({
        compatibilitySetId: entry.compatibilitySetId,
        missionId: entry.missionId,
        compatibilityState: entry.compatibilityState,
        supportedTeamCount: entry.supportedTeamCount,
        blockedTeamCount: entry.blockedTeamCount,
        manualReviewTeamCount: entry.manualReviewTeamCount,
        unsupportedTeamCount: entry.unsupportedTeamCount,
      }))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  function inspectCompatibilitySetByMission(missionId: string) {
    return projection.projectOne(missionId);
  }

  function getCompatibilityStatusByMission(missionId: string) {
    return projection.projectOne(missionId).statusPreview;
  }

  function getCandidateTeamsByMission(missionId: string): MissionTeamCompatibilityCandidate[] {
    return projection.projectOne(missionId).candidateTeams;
  }

  function getBlockedTeamsByMission(missionId: string): MissionTeamCompatibilityCandidate[] {
    return projection
      .projectOne(missionId)
      .candidateTeams
      .filter((entry) => entry.assignmentReadiness === 'blocked');
  }

  function getReadyTeamsByMission(missionId: string): MissionTeamCompatibilityCandidate[] {
    return projection
      .projectOne(missionId)
      .candidateTeams
      .filter((entry) => entry.assignmentReadiness === 'ready');
  }

  function getCompatibilityHistoryByMission(missionId: string) {
    const projected = projection.projectOne(missionId);
    return historyStore.load({
      compatibilitySetId: projected.compatibilitySetId,
      missionId: projected.missionId,
    });
  }

  function evaluateCompatibilityByMission(missionId: string) {
    return evaluator.evaluateMissionCompatibility(missionId);
  }

  function materializeCompatibilityByMission(missionId: string) {
    return materializer.materializeOne(missionId);
  }

  return {
    listCompatibilitySets,
    inspectCompatibilitySetByMission,
    getCompatibilityStatusByMission,
    getCandidateTeamsByMission,
    getBlockedTeamsByMission,
    getReadyTeamsByMission,
    getCompatibilityHistoryByMission,
    evaluateCompatibilityByMission,
    materializeCompatibilityByMission,
  };
}

export type TeamCompatibilityInspection = ReturnType<typeof createTeamCompatibilityInspection>;
