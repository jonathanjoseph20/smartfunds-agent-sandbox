import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  createMissionProjection,
  type MissionProjectionEngine,
} from '../missions/mission-projection.ts';
import {
  createTeamCompatibilityProjection,
  type TeamCompatibilityProjectionEngine,
} from '../team-compatibility/team-compatibility-projection.ts';

import {
  DEFAULT_MISSION_ASSIGNMENT_POLICY_ID,
  getMissionAssignmentPolicy,
} from './mission-assignment-policies.ts';
import type { MissionAssignmentPolicy } from './mission-assignment-policy-types.ts';
import {
  deriveManualReviewTriggers,
  deriveMissionAssignmentStatus,
} from './mission-assignment-status.ts';
import type {
  AssignmentPolicyScoreClass,
  MissionAssignmentCandidate,
  MissionAssignmentDecision,
  MissionAssignmentFounderOverride,
} from './mission-assignment-types.ts';

const COMPATIBILITY_CLASS_PRIORITY: Record<MissionAssignmentCandidate['compatibilityClass'], number> = {
  strong_match: 0,
  partial_match: 1,
  conditional_match: 2,
  unsupported: 3,
  inconclusive: 4,
};

const ASSIGNMENT_READINESS_PRIORITY: Record<MissionAssignmentCandidate['assignmentReadiness'], number> = {
  ready: 0,
  manual_review_required: 1,
  incomplete: 2,
  blocked: 3,
  inconclusive: 4,
};

const LIFECYCLE_PRIORITY: Record<MissionAssignmentCandidate['teamLifecycleState'], number> = {
  active: 0,
  defined: 1,
  dormant: 2,
  archived: 3,
};

const AVAILABILITY_PRIORITY: Record<MissionAssignmentCandidate['availabilityState'], number> = {
  available: 0,
  restricted: 1,
  manual_only: 2,
  unavailable: 3,
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function policyScoreClass(candidate: MissionAssignmentCandidate): AssignmentPolicyScoreClass {
  if (candidate.compatibilityClass === 'inconclusive' || candidate.assignmentReadiness === 'inconclusive') {
    return 'inconclusive';
  }
  if (candidate.compatibilityClass === 'unsupported' || candidate.assignmentReadiness === 'blocked') {
    return 'none';
  }
  if (candidate.compatibilityClass === 'strong_match' && candidate.assignmentReadiness === 'ready') {
    return 'high';
  }
  if (candidate.compatibilityClass === 'partial_match') {
    return 'medium';
  }
  return 'low';
}

function compareCandidates(left: MissionAssignmentCandidate, right: MissionAssignmentCandidate): number {
  const compatibilityCmp = COMPATIBILITY_CLASS_PRIORITY[left.compatibilityClass]
    - COMPATIBILITY_CLASS_PRIORITY[right.compatibilityClass];
  if (compatibilityCmp !== 0) {
    return compatibilityCmp;
  }

  const readinessCmp = ASSIGNMENT_READINESS_PRIORITY[left.assignmentReadiness]
    - ASSIGNMENT_READINESS_PRIORITY[right.assignmentReadiness];
  if (readinessCmp !== 0) {
    return readinessCmp;
  }

  const lifecycleCmp = LIFECYCLE_PRIORITY[left.teamLifecycleState] - LIFECYCLE_PRIORITY[right.teamLifecycleState];
  if (lifecycleCmp !== 0) {
    return lifecycleCmp;
  }

  const availabilityCmp = AVAILABILITY_PRIORITY[left.availabilityState] - AVAILABILITY_PRIORITY[right.availabilityState];
  if (availabilityCmp !== 0) {
    return availabilityCmp;
  }

  return left.teamId.localeCompare(right.teamId);
}

function selectionKey(candidate: MissionAssignmentCandidate): string {
  return [
    String(COMPATIBILITY_CLASS_PRIORITY[candidate.compatibilityClass]),
    String(ASSIGNMENT_READINESS_PRIORITY[candidate.assignmentReadiness]),
    String(LIFECYCLE_PRIORITY[candidate.teamLifecycleState]),
    String(AVAILABILITY_PRIORITY[candidate.availabilityState]),
  ].join(':');
}

function isSelectable(candidate: MissionAssignmentCandidate): boolean {
  return candidate.compatibilityClass !== 'unsupported'
    && candidate.compatibilityClass !== 'inconclusive'
    && candidate.assignmentReadiness !== 'blocked'
    && candidate.assignmentReadiness !== 'inconclusive';
}

function deriveAssignmentDecisionId(input: {
  missionId: string;
  compatibilitySetId: string;
  assignmentPolicyId: string;
  candidatePayload: {
    selectedTeamId?: string;
    assignmentMode: string;
    decisionState: string;
    founderOverride: MissionAssignmentFounderOverride;
    candidateTeams: MissionAssignmentCandidate[];
    alternativeTeams: string[];
    manualReviewTriggers: string[];
  };
}): string {
  return sha256(canonicalStringify({
    missionId: input.missionId,
    compatibilitySetId: input.compatibilitySetId,
    assignmentPolicyId: input.assignmentPolicyId,
    candidatePayload: input.candidatePayload,
  }));
}

export interface MissionAssignmentEvaluationResult {
  assignmentDecision: MissionAssignmentDecision;
  recommendedTeamId?: string;
  candidateTeams: MissionAssignmentCandidate[];
  alternativeTeams: string[];
  decisionState: MissionAssignmentDecision['decisionState'];
  assignmentMode: MissionAssignmentDecision['assignmentMode'];
  manualReviewRequired: boolean;
  reasonTokens: string[];
  blockingReasons: string[];
}

export function createMissionAssignmentEvaluator(options: {
  missionProjection?: MissionProjectionEngine;
  compatibilityProjection?: TeamCompatibilityProjectionEngine;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
} = {}) {
  const missionProjection = options.missionProjection ?? createMissionProjection({
    definitionsDir: options.missionDefinitionsDir,
    instancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
  });

  const compatibilityProjection = options.compatibilityProjection ?? createTeamCompatibilityProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
  });

  function evaluateMissionAssignment(input: {
    missionId: string;
    assignmentPolicyId?: string;
    founderOverride?: MissionAssignmentFounderOverride;
  }): MissionAssignmentEvaluationResult {
    const mission = missionProjection.projectOne(input.missionId);
    const compatibility = compatibilityProjection.projectOne(input.missionId);
    const policy = getMissionAssignmentPolicy(input.assignmentPolicyId ?? DEFAULT_MISSION_ASSIGNMENT_POLICY_ID);
    const founderOverride = input.founderOverride ?? { applied: false };

    const rankedCandidates = compatibility.candidateTeams
      .map((entry): MissionAssignmentCandidate => ({
        teamId: entry.teamId,
        compatibilityClass: entry.compatibilityClass,
        assignmentReadiness: entry.assignmentReadiness,
        assignmentRank: 0,
        policyScoreClass: 'none',
        matchReasons: entry.matchReasons,
        blockingReasons: entry.blockingReasons,
        limitations: entry.limitations,
        teamLifecycleState: entry.teamLifecycleState,
        availabilityState: entry.availabilityState,
      }))
      .sort(compareCandidates)
      .map((entry, index) => ({
        ...entry,
        assignmentRank: index + 1,
        policyScoreClass: policyScoreClass(entry),
      }));

    const topSelectionKey = rankedCandidates[0] ? selectionKey(rankedCandidates[0]) : null;
    const topRankedCandidates = topSelectionKey
      ? rankedCandidates.filter((entry) => selectionKey(entry) === topSelectionKey)
      : [];

    const selectable = rankedCandidates.filter((entry) => isSelectable(entry));
    const recommendedTeamId = selectable[0]?.teamId;

    if (founderOverride.applied) {
      if (!founderOverride.selectedTeamId) {
        throw new Error('MISSING_ARGUMENT: founderOverride.selectedTeamId');
      }
      if (!rankedCandidates.some((entry) => entry.teamId === founderOverride.selectedTeamId)) {
        throw new Error(`MISSION_ASSIGNMENT_OVERRIDE_TEAM_NOT_CANDIDATE: ${founderOverride.selectedTeamId}`);
      }
    }

    const manualReviewTriggers = deriveManualReviewTriggers({
      policy,
      candidateTeams: rankedCandidates,
      topRankedCandidates,
      hasTopTie: topRankedCandidates.length > 1,
    });

    const selectedTeamId = founderOverride.applied
      ? founderOverride.selectedTeamId
      : recommendedTeamId;

    const status = deriveMissionAssignmentStatus({
      policy,
      candidateTeams: rankedCandidates,
      selectedTeamId,
      manualReviewTriggers,
      founderOverrideApplied: founderOverride.applied,
    });

    const selectedCandidate = selectedTeamId
      ? rankedCandidates.find((entry) => entry.teamId === selectedTeamId)
      : undefined;

    const matchReasons = uniqueSorted([
      ...(selectedCandidate?.matchReasons ?? []),
      ...(founderOverride.applied ? ['founder_override_applied'] : []),
    ]);

    const blockingReasons = uniqueSorted([
      ...manualReviewTriggers,
      ...(selectedCandidate?.blockingReasons ?? []),
      ...(recommendedTeamId ? [] : ['no_selectable_candidates']),
      ...(rankedCandidates.length > 0 ? [] : ['no_compatible_candidates']),
    ]);

    const limitations = uniqueSorted([
      ...compatibility.limitations,
      ...(selectedCandidate?.limitations ?? []),
      ...(founderOverride.applied ? [] : ['assignment_pre_execution_only']),
    ]);

    const alternativeTeams = selectable
      .map((entry) => entry.teamId)
      .filter((teamId) => teamId !== selectedTeamId)
      .sort((left, right) => left.localeCompare(right));

    const assignmentDecisionId = deriveAssignmentDecisionId({
      missionId: mission.missionId,
      compatibilitySetId: compatibility.compatibilitySetId,
      assignmentPolicyId: policy.assignmentPolicyId,
      candidatePayload: {
        selectedTeamId,
        assignmentMode: status.assignmentMode,
        decisionState: status.decisionState,
        founderOverride,
        candidateTeams: rankedCandidates,
        alternativeTeams,
        manualReviewTriggers,
      },
    });

    const assignmentDecision: MissionAssignmentDecision = {
      assignmentDecisionId,
      missionId: mission.missionId,
      compatibilitySetId: compatibility.compatibilitySetId,
      ...(selectedTeamId ? { selectedTeamId } : {}),
      assignmentPolicyId: policy.assignmentPolicyId,
      assignmentMode: status.assignmentMode,
      decisionState: status.decisionState,
      decisionReason: status.decisionReason,
      matchReasons,
      blockingReasons,
      limitations,
      candidateTeams: rankedCandidates,
      alternativeTeams,
      founderOverride,
      createdFrom: (mission.instance.createdFrom ?? { kind: 'unknown' }) as MissionAssignmentDecision['createdFrom'],
      historyDigest: '',
    };

    return {
      assignmentDecision,
      ...(recommendedTeamId ? { recommendedTeamId } : {}),
      candidateTeams: rankedCandidates,
      alternativeTeams,
      decisionState: assignmentDecision.decisionState,
      assignmentMode: assignmentDecision.assignmentMode,
      manualReviewRequired: manualReviewTriggers.length > 0,
      reasonTokens: uniqueSorted([
        status.decisionReason,
        ...manualReviewTriggers,
      ]),
      blockingReasons,
    };
  }

  function evaluateAllMissionAssignments(input: {
    assignmentPolicyId?: string;
  } = {}): MissionAssignmentEvaluationResult[] {
    const policyId = input.assignmentPolicyId ?? DEFAULT_MISSION_ASSIGNMENT_POLICY_ID;

    return missionProjection
      .projectAll()
      .map((entry) => evaluateMissionAssignment({
        missionId: entry.missionId,
        assignmentPolicyId: policyId,
      }))
      .sort((left, right) => left.assignmentDecision.missionId.localeCompare(right.assignmentDecision.missionId));
  }

  function getPolicy(assignmentPolicyId?: string): MissionAssignmentPolicy {
    return getMissionAssignmentPolicy(assignmentPolicyId ?? DEFAULT_MISSION_ASSIGNMENT_POLICY_ID);
  }

  return {
    evaluateMissionAssignment,
    evaluateAllMissionAssignments,
    getPolicy,
  };
}

export type MissionAssignmentEvaluator = ReturnType<typeof createMissionAssignmentEvaluator>;
