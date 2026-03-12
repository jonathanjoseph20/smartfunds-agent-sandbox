import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createMissionAssignmentEvaluator,
  type MissionAssignmentEvaluator,
} from './mission-assignment-evaluator.ts';
import {
  createMissionAssignmentHistoryStore,
  resolveMissionAssignmentArtifactPaths,
  type MissionAssignmentHistoryStore,
} from './mission-assignment-history-store.ts';
import { getMissionAssignmentPolicy } from './mission-assignment-policies.ts';
import { deriveMissionAssignmentStatus } from './mission-assignment-status.ts';
import type {
  MissionAssignmentFounderOverride,
  MissionAssignmentProjection,
} from './mission-assignment-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function computeHistoryDigest(input: { entries: unknown[] }): string {
  return sha256(canonicalStringify(input.entries));
}

function extractManualReviewTriggers(blockingReasons: string[]): string[] {
  const known = new Set([
    'tie_among_top_candidates',
    'top_candidate_manual_only',
    'top_candidate_restricted',
    'no_strong_match',
    'manual_review_first_policy',
    'founder_confirmation_required',
  ]);

  return blockingReasons
    .filter((entry) => known.has(entry))
    .sort((left, right) => left.localeCompare(right));
}

export function createMissionAssignmentProjection(options: {
  evaluator?: MissionAssignmentEvaluator;
  historyStore?: MissionAssignmentHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
} = {}) {
  const evaluator = options.evaluator ?? createMissionAssignmentEvaluator({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createMissionAssignmentHistoryStore({
    artifactsRoot: options.assignmentArtifactsRoot,
  });

  function projectOne(input: {
    missionId: string;
    assignmentPolicyId?: string;
    founderOverride?: MissionAssignmentFounderOverride;
  }): MissionAssignmentProjection {
    const resolvedContext = input.founderOverride
      ? undefined
      : historyStore.getCurrentMissionResolution(input.missionId);

    const evaluated = evaluator.evaluateMissionAssignment({
      missionId: input.missionId,
      assignmentPolicyId: input.assignmentPolicyId ?? resolvedContext?.assignmentPolicyId,
      founderOverride: input.founderOverride ?? resolvedContext?.founderOverride,
    });

    const policy = getMissionAssignmentPolicy(evaluated.assignmentDecision.assignmentPolicyId);
    const history = historyStore.load({
      assignmentDecisionId: evaluated.assignmentDecision.assignmentDecisionId,
      missionId: evaluated.assignmentDecision.missionId,
    });

    const recomputedStatus = deriveMissionAssignmentStatus({
      policy,
      candidateTeams: evaluated.assignmentDecision.candidateTeams,
      selectedTeamId: evaluated.assignmentDecision.selectedTeamId,
      manualReviewTriggers: extractManualReviewTriggers(evaluated.assignmentDecision.blockingReasons),
      founderOverrideApplied: evaluated.assignmentDecision.founderOverride.applied,
      historyEntries: history.entries,
    });

    const historyDigest = computeHistoryDigest({ entries: history.entries });
    const artifactPaths = resolveMissionAssignmentArtifactPaths({
      assignmentDecisionId: evaluated.assignmentDecision.assignmentDecisionId,
      rootDir: options.assignmentArtifactsRoot,
    });

    const statusPreview = {
      assignmentDecisionId: evaluated.assignmentDecision.assignmentDecisionId,
      missionId: evaluated.assignmentDecision.missionId,
      compatibilitySetId: evaluated.assignmentDecision.compatibilitySetId,
      assignmentPolicyId: evaluated.assignmentDecision.assignmentPolicyId,
      assignmentMode: recomputedStatus.assignmentMode,
      decisionState: recomputedStatus.decisionState,
      decisionReason: recomputedStatus.decisionReason,
      selectedTeamId: evaluated.assignmentDecision.selectedTeamId ?? null,
      blockingReasons: evaluated.assignmentDecision.blockingReasons,
      limitations: evaluated.assignmentDecision.limitations,
      historyDigest,
    } as Record<string, unknown>;

    const reportPreview = {
      ...evaluated.assignmentDecision,
      assignmentMode: recomputedStatus.assignmentMode,
      decisionState: recomputedStatus.decisionState,
      decisionReason: recomputedStatus.decisionReason,
      history,
      historyDigest,
    } as Record<string, unknown>;

    return {
      ...evaluated.assignmentDecision,
      assignmentMode: recomputedStatus.assignmentMode,
      decisionState: recomputedStatus.decisionState,
      decisionReason: recomputedStatus.decisionReason,
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
      statusPreview,
      reportPreview,
      artifactPaths,
    };
  }

  function projectAll(input: { assignmentPolicyId?: string } = {}): MissionAssignmentProjection[] {
    return evaluator
      .evaluateAllMissionAssignments({ assignmentPolicyId: input.assignmentPolicyId })
      .map((entry) => projectOne({
        missionId: entry.assignmentDecision.missionId,
        assignmentPolicyId: entry.assignmentDecision.assignmentPolicyId,
      }))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  function summarizeList(input: { assignmentPolicyId?: string } = {}) {
    return projectAll(input)
      .map((entry) => ({
        assignmentDecisionId: entry.assignmentDecisionId,
        missionId: entry.missionId,
        compatibilitySetId: entry.compatibilitySetId,
        selectedTeamId: entry.selectedTeamId ?? null,
        assignmentPolicyId: entry.assignmentPolicyId,
        assignmentMode: entry.assignmentMode,
        decisionState: entry.decisionState,
        alternativeTeams: uniqueSorted(entry.alternativeTeams),
      }))
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type MissionAssignmentProjectionEngine = ReturnType<typeof createMissionAssignmentProjection>;
