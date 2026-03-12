import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  createMissionAssignmentProjection,
  type MissionAssignmentProjectionEngine,
} from '../mission-assignment/mission-assignment-projection.ts';
import {
  createMissionDAGProjection,
  type MissionDAGProjectionEngine,
} from '../missions/dag/mission-dag-projection.ts';
import {
  createMissionProjection,
  type MissionProjectionEngine,
} from '../missions/mission-projection.ts';
import {
  createTeamCompatibilityProjection,
  type TeamCompatibilityProjectionEngine,
} from '../team-compatibility/team-compatibility-projection.ts';
import {
  createTeamProjection,
  type TeamProjectionEngine,
} from '../teams/team-projection.ts';

import {
  DEFAULT_MISSION_ACTIVATION_POLICY_ID,
  getMissionActivationPolicy,
} from './mission-activation-policies.ts';
import type { MissionActivationPolicy } from './mission-activation-policy-types.ts';
import { deriveMissionActivationStatus } from './mission-activation-status.ts';
import type {
  ActivationMode,
  ActivationPreconditionCategory,
  ActivationPreconditionResult,
  MissionActivationDecision,
} from './mission-activation-types.ts';

const PRECONDITION_CATEGORY_ORDER: ActivationPreconditionCategory[] = [
  'mission_state',
  'mission_readiness',
  'dag_dependencies',
  'assignment_state',
  'assignment_confirmation',
  'team_lifecycle',
  'team_availability',
  'team_readiness',
  'activation_confirmation',
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function sortPreconditions(results: ActivationPreconditionResult[]): ActivationPreconditionResult[] {
  return [...results].sort((left, right) => {
    const leftIdx = PRECONDITION_CATEGORY_ORDER.indexOf(left.category);
    const rightIdx = PRECONDITION_CATEGORY_ORDER.indexOf(right.category);
    if (leftIdx !== rightIdx) {
      return leftIdx - rightIdx;
    }
    return left.preconditionId.localeCompare(right.preconditionId);
  });
}

function normalizePreconditionResults(results: ActivationPreconditionResult[]): Array<{
  preconditionId: string;
  category: string;
  state: string;
  reasonTokens: string[];
  blockingReasons: string[];
  limitations: string[];
}> {
  return sortPreconditions(results).map((entry) => ({
    preconditionId: entry.preconditionId,
    category: entry.category,
    state: entry.state,
    reasonTokens: uniqueSorted(entry.reasonTokens),
    blockingReasons: uniqueSorted(entry.blockingReasons),
    limitations: uniqueSorted(entry.limitations),
  }));
}

function deriveActivationMode(input: {
  policy: MissionActivationPolicy;
  assignmentState: string;
  manualGateRequired: boolean;
}): ActivationMode {
  if (input.assignmentState === 'blocked' || input.assignmentState === 'rejected') {
    return 'no_activation';
  }

  if (input.policy.requiresFounderActivationConfirmation) {
    return 'founder_review_required';
  }

  if (input.manualGateRequired || input.policy.activationPolicyId === 'manual-gate-only') {
    return 'manual_gate';
  }

  return 'policy_evaluated';
}

function buildPrecondition(input: {
  preconditionId: string;
  category: ActivationPreconditionCategory;
  state: ActivationPreconditionResult['state'];
  reasonTokens?: string[];
  blockingReasons?: string[];
  limitations?: string[];
}): ActivationPreconditionResult {
  return {
    preconditionId: input.preconditionId,
    category: input.category,
    state: input.state,
    reasonTokens: uniqueSorted(input.reasonTokens ?? []),
    blockingReasons: uniqueSorted(input.blockingReasons ?? []),
    limitations: uniqueSorted(input.limitations ?? []),
  };
}

function deriveActivationDecisionId(input: {
  missionId: string;
  assignmentDecisionId: string;
  activationPolicyId: string;
  activationMode: ActivationMode;
  preconditionResults: ActivationPreconditionResult[];
}): string {
  return sha256(canonicalStringify({
    missionId: input.missionId,
    assignmentDecisionId: input.assignmentDecisionId,
    activationPolicyId: input.activationPolicyId,
    normalizedPreconditionResults: normalizePreconditionResults(input.preconditionResults),
    activationMode: input.activationMode,
  }));
}

export interface MissionActivationEvaluationResult {
  activationDecision: MissionActivationDecision;
}

export function createMissionActivationEvaluator(options: {
  missionProjection?: MissionProjectionEngine;
  assignmentProjection?: MissionAssignmentProjectionEngine;
  teamProjection?: TeamProjectionEngine;
  compatibilityProjection?: TeamCompatibilityProjectionEngine;
  dagProjection?: MissionDAGProjectionEngine;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  dagDefinitionsDir?: string;
  missionDAGArtifactsRoot?: string;
} = {}) {
  const missionProjection = options.missionProjection ?? createMissionProjection({
    definitionsDir: options.missionDefinitionsDir,
    instancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
  });

  const assignmentProjection = options.assignmentProjection ?? createMissionAssignmentProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
  });

  const teamProjection = options.teamProjection ?? createTeamProjection({
    definitionsDir: options.teamDefinitionsDir,
  });

  const compatibilityProjection = options.compatibilityProjection ?? createTeamCompatibilityProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
  });

  const dagProjection = options.dagProjection ?? createMissionDAGProjection({
    dagDefinitionsDir: options.dagDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionDAGArtifactsRoot: options.missionDAGArtifactsRoot,
  });

  function evaluateActivation(input: {
    missionId: string;
    activationPolicyId?: string;
  }): MissionActivationEvaluationResult {
    const mission = missionProjection.projectOne(input.missionId);
    const assignment = assignmentProjection.projectOne({ missionId: input.missionId });
    const compatibility = compatibilityProjection.projectOne(input.missionId);
    const policy = getMissionActivationPolicy(input.activationPolicyId ?? DEFAULT_MISSION_ACTIVATION_POLICY_ID);

    if (!assignment.selectedTeamId) {
      throw new Error(`MISSION_ACTIVATION_NO_SELECTED_TEAM: ${input.missionId}`);
    }

    const selectedCandidate = assignment.candidateTeams.find((entry) => entry.teamId === assignment.selectedTeamId);
    if (!selectedCandidate) {
      throw new Error(`MISSION_ACTIVATION_SELECTED_TEAM_NOT_IN_ASSIGNMENT: ${assignment.selectedTeamId}`);
    }

    let teamStatus: { lifecycleState: string; availabilityState: string; readinessState: string } | undefined;
    try {
      const projectedTeam = teamProjection.projectOne(assignment.selectedTeamId);
      teamStatus = {
        lifecycleState: projectedTeam.status.lifecycleState,
        availabilityState: projectedTeam.status.availabilityState,
        readinessState: projectedTeam.status.readinessState,
      };
    } catch {
      teamStatus = undefined;
    }

    const missionStatePrecondition = buildPrecondition({
      preconditionId: 'mission-state',
      category: 'mission_state',
      state: mission.status.lifecycleState === 'archived'
        ? 'blocked'
        : mission.status.approvalState === 'rejected'
          ? 'blocked'
          : 'satisfied',
      reasonTokens: mission.status.lifecycleState === 'archived'
        ? ['mission_archived']
        : mission.status.approvalState === 'rejected'
          ? ['mission_rejected']
          : ['mission_state_valid'],
      blockingReasons: mission.status.lifecycleState === 'archived'
        ? ['mission_archived']
        : mission.status.approvalState === 'rejected'
          ? ['mission_rejected']
          : [],
    });

    const missionReadinessPrecondition = buildPrecondition({
      preconditionId: 'mission-readiness',
      category: 'mission_readiness',
      state: !policy.requiresMissionReady
        ? 'satisfied'
        : mission.status.readinessState === 'ready'
          ? 'satisfied'
          : mission.status.readinessState === 'blocked'
            ? 'blocked'
            : mission.status.readinessState === 'inconclusive'
              ? 'inconclusive'
              : 'incomplete',
      reasonTokens: !policy.requiresMissionReady
        ? ['mission_readiness_not_required']
        : [`mission_readiness:${mission.status.readinessState}`],
      blockingReasons: policy.requiresMissionReady && mission.status.readinessState === 'blocked'
        ? ['mission_readiness_blocked']
        : [],
      limitations: policy.requiresMissionReady && mission.status.readinessState !== 'ready'
        ? ['mission_readiness_not_ready']
        : [],
    });

    const dags = dagProjection.projectAll().filter((entry) => entry.nodeStates.some((node) => node.missionId === mission.missionId));
    const dependencyStates = dags.flatMap((dag) => {
      const node = dag.nodeStates.find((entry) => entry.missionId === mission.missionId);
      if (!node) {
        return [];
      }
      return node.dependencyMissionIds.map((dependencyMissionId) => {
        const dependency = dag.nodeStates.find((entry) => entry.missionId === dependencyMissionId);
        return dependency?.state ?? 'INCONCLUSIVE';
      });
    });

    const dagDependenciesPrecondition = buildPrecondition({
      preconditionId: 'dag-dependencies',
      category: 'dag_dependencies',
      state: !policy.requiresDagDependenciesSatisfied
        ? 'satisfied'
        : dependencyStates.length === 0
          ? 'satisfied'
          : dependencyStates.some((entry) => entry === 'INCONCLUSIVE')
            ? 'inconclusive'
            : dependencyStates.some((entry) => entry === 'BLOCKED')
              ? 'blocked'
              : dependencyStates.every((entry) => entry === 'COMPLETED')
                ? 'satisfied'
                : 'waiting',
      reasonTokens: !policy.requiresDagDependenciesSatisfied
        ? ['dag_dependencies_not_required']
        : dependencyStates.length === 0
          ? ['dag_dependencies_not_present']
          : [`dag_dependency_states:${dependencyStates.join(',')}`],
      blockingReasons: policy.requiresDagDependenciesSatisfied && dependencyStates.some((entry) => entry === 'BLOCKED')
        ? ['dag_dependency_blocked']
        : [],
      limitations: policy.requiresDagDependenciesSatisfied && dependencyStates.some((entry) => entry !== 'COMPLETED')
        ? ['dag_dependencies_not_satisfied']
        : [],
    });

    const assignmentStatePrecondition = buildPrecondition({
      preconditionId: 'assignment-state',
      category: 'assignment_state',
      state: assignment.assignmentDecisionId.length > 0 ? 'satisfied' : 'incomplete',
      reasonTokens: [
        `assignment_state:${assignment.decisionState}`,
        `assignment_mode:${assignment.assignmentMode}`,
      ],
      blockingReasons: assignment.decisionState === 'blocked' ? ['assignment_decision_blocked'] : [],
      limitations: assignment.selectedTeamId ? [] : ['assignment_selected_team_missing'],
    });

    const assignmentConfirmationPrecondition = buildPrecondition({
      preconditionId: 'assignment-confirmation',
      category: 'assignment_confirmation',
      state: !policy.requiresConfirmedAssignment
        ? 'satisfied'
        : assignment.decisionState === 'confirmed'
          ? 'satisfied'
          : 'waiting',
      reasonTokens: !policy.requiresConfirmedAssignment
        ? ['assignment_confirmation_not_required']
        : [`assignment_decision_state:${assignment.decisionState}`],
      blockingReasons: [],
      limitations: policy.requiresConfirmedAssignment && assignment.decisionState !== 'confirmed'
        ? ['assignment_confirmation_pending']
        : [],
    });

    const teamLifecycleState = teamStatus?.lifecycleState ?? selectedCandidate.teamLifecycleState;
    const teamAvailabilityState = teamStatus?.availabilityState ?? selectedCandidate.availabilityState;
    const teamReadinessState = teamStatus?.readinessState ?? 'inconclusive';

    const teamLifecyclePrecondition = buildPrecondition({
      preconditionId: 'team-lifecycle',
      category: 'team_lifecycle',
      state: teamLifecycleState === 'archived'
        ? 'blocked'
        : teamLifecycleState === 'defined' || teamLifecycleState === 'active' || teamLifecycleState === 'dormant'
          ? 'satisfied'
          : 'inconclusive',
      reasonTokens: [`team_lifecycle:${teamLifecycleState}`],
      blockingReasons: teamLifecycleState === 'archived' ? ['team_archived'] : [],
    });

    const teamAvailabilityPrecondition = buildPrecondition({
      preconditionId: 'team-availability',
      category: 'team_availability',
      state: !policy.requiresTeamAvailable
        ? 'satisfied'
        : teamAvailabilityState === 'unavailable'
          ? 'blocked'
          : teamAvailabilityState === 'restricted' || teamAvailabilityState === 'manual_only'
            ? 'waiting'
            : 'satisfied',
      reasonTokens: !policy.requiresTeamAvailable
        ? ['team_availability_not_required']
        : [`team_availability:${teamAvailabilityState}`],
      blockingReasons: policy.requiresTeamAvailable && teamAvailabilityState === 'unavailable'
        ? ['team_unavailable']
        : [],
      limitations: policy.requiresTeamAvailable && (teamAvailabilityState === 'restricted' || teamAvailabilityState === 'manual_only')
        ? ['team_availability_requires_manual_gate']
        : [],
    });

    const teamReadinessPrecondition = buildPrecondition({
      preconditionId: 'team-readiness',
      category: 'team_readiness',
      state: !policy.requiresTeamReady
        ? 'satisfied'
        : teamReadinessState === 'ready'
          ? 'satisfied'
          : teamReadinessState === 'blocked'
            ? 'blocked'
            : teamReadinessState === 'inconclusive'
              ? 'inconclusive'
              : teamReadinessState === 'incomplete'
                ? 'incomplete'
                : 'waiting',
      reasonTokens: !policy.requiresTeamReady
        ? ['team_readiness_not_required']
        : [`team_readiness:${teamReadinessState}`],
      blockingReasons: policy.requiresTeamReady && teamReadinessState === 'blocked'
        ? ['team_readiness_blocked']
        : [],
      limitations: policy.requiresTeamReady && teamReadinessState !== 'ready'
        ? ['team_readiness_not_ready']
        : [],
    });

    const manualReviewFlagged = assignment.decisionState === 'under_review'
      || assignment.assignmentMode === 'manual_review_required'
      || compatibility.manualReviewTeamCount > 0;

    const activationConfirmationPrecondition = buildPrecondition({
      preconditionId: 'activation-confirmation',
      category: 'activation_confirmation',
      state: policy.requiresFounderActivationConfirmation ? 'waiting' : 'satisfied',
      reasonTokens: policy.requiresFounderActivationConfirmation
        ? ['activation_confirmation_required']
        : ['activation_confirmation_not_required'],
      blockingReasons: [],
      limitations: policy.requiresFounderActivationConfirmation ? ['founder_activation_confirmation_pending'] : [],
    });

    const preconditionResults = sortPreconditions([
      missionStatePrecondition,
      missionReadinessPrecondition,
      dagDependenciesPrecondition,
      assignmentStatePrecondition,
      assignmentConfirmationPrecondition,
      teamLifecyclePrecondition,
      teamAvailabilityPrecondition,
      teamReadinessPrecondition,
      activationConfirmationPrecondition,
    ]);

    const activationMode = deriveActivationMode({
      policy,
      assignmentState: assignment.decisionState,
      manualGateRequired: manualReviewFlagged,
    });

    const status = deriveMissionActivationStatus({
      policy,
      activationMode,
      preconditionResults,
    });

    const activationDecisionId = deriveActivationDecisionId({
      missionId: mission.missionId,
      assignmentDecisionId: assignment.assignmentDecisionId,
      activationPolicyId: policy.activationPolicyId,
      activationMode,
      preconditionResults,
    });

    const activationDecision: MissionActivationDecision = {
      activationDecisionId,
      missionId: mission.missionId,
      assignmentDecisionId: assignment.assignmentDecisionId,
      selectedTeamId: assignment.selectedTeamId,
      activationPolicyId: policy.activationPolicyId,
      activationMode,
      activationState: status.activationState,
      executionReadinessState: status.executionReadinessState,
      preconditionResults,
      blockingReasons: uniqueSorted(status.blockingReasons),
      limitations: uniqueSorted([
        ...status.limitations,
        'activation_pre_execution_only',
        ...(manualReviewFlagged ? ['manual_review_constraints_present'] : []),
      ]),
      activationReasonTokens: uniqueSorted(status.activationReasonTokens),
      handoffContract: {
        missionId: mission.missionId,
        selectedTeamId: assignment.selectedTeamId,
        assignmentDecisionId: assignment.assignmentDecisionId,
        activationDecisionId,
        missionType: mission.missionType,
        deliverableSummary: mission.deliverableSummary,
        executionPreconditionsSatisfied: status.executionReadinessState === 'ready',
        remainingBlockers: uniqueSorted(status.blockingReasons),
        runtimeInvocationSupported: false,
      },
      createdFrom: (mission.instance.createdFrom ?? { kind: 'unknown' }) as MissionActivationDecision['createdFrom'],
      historyDigest: '',
    };

    return {
      activationDecision,
    };
  }

  function evaluateAllActivations(input: { activationPolicyId?: string } = {}): MissionActivationEvaluationResult[] {
    const policyId = input.activationPolicyId ?? DEFAULT_MISSION_ACTIVATION_POLICY_ID;

    return missionProjection.projectAll()
      .map((mission) => evaluateActivation({
        missionId: mission.missionId,
        activationPolicyId: policyId,
      }))
      .sort((left, right) => left.activationDecision.missionId.localeCompare(right.activationDecision.missionId));
  }

  function getPolicy(activationPolicyId?: string): MissionActivationPolicy {
    return getMissionActivationPolicy(activationPolicyId ?? DEFAULT_MISSION_ACTIVATION_POLICY_ID);
  }

  return {
    evaluateActivation,
    evaluateAllActivations,
    getPolicy,
  };
}

export type MissionActivationEvaluator = ReturnType<typeof createMissionActivationEvaluator>;
