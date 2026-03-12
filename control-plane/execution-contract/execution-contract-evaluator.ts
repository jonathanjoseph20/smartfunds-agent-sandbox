import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  createMissionActivationProjection,
  type MissionActivationProjectionEngine,
} from '../mission-activation/mission-activation-projection.ts';
import {
  createMissionAssignmentProjection,
  type MissionAssignmentProjectionEngine,
} from '../mission-assignment/mission-assignment-projection.ts';
import {
  createMissionProjection,
  type MissionProjectionEngine,
} from '../missions/mission-projection.ts';
import {
  createTeamProjection,
  type TeamProjectionEngine,
} from '../teams/team-projection.ts';

import {
  DEFAULT_EXECUTION_CONTRACT_POLICY_ID,
  getExecutionContractPolicy,
} from './execution-contract-policies.ts';
import type { ExecutionContractPolicy } from './execution-contract-policy-types.ts';
import { deriveExecutionContractStatus } from './execution-contract-status.ts';
import type {
  DeliverableScope,
  ExecutionContractPreconditionCategory,
  ExecutionContractPreconditionResult,
  ExecutionDependencySummary,
  ExecutionTarget,
  MissionExecutionContract,
} from './execution-contract-types.ts';
import {
  EXECUTION_AUTHORIZED_ACTIONS,
  EXECUTION_PROHIBITED_ACTIONS,
} from './execution-contract-types.ts';

const PRECONDITION_CATEGORY_ORDER: ExecutionContractPreconditionCategory[] = [
  'mission',
  'assignment',
  'activation',
  'team',
  'execution_target',
  'runtime_governance',
];

const PRECONDITION_ORDER: string[] = [
  'mission_exists',
  'assignment_exists',
  'assignment_confirmed',
  'activation_exists',
  'activation_ready',
  'team_ready',
  'team_available',
  'execution_target',
  'runtime_governance',
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueSorted(value.flatMap((entry) => (typeof entry === 'string' && entry.length > 0 ? [entry] : [])));
}

function sortPreconditions(results: ExecutionContractPreconditionResult[]): ExecutionContractPreconditionResult[] {
  return [...results].sort((left, right) => {
    const leftCategoryIndex = PRECONDITION_CATEGORY_ORDER.indexOf(left.category);
    const rightCategoryIndex = PRECONDITION_CATEGORY_ORDER.indexOf(right.category);

    if (leftCategoryIndex !== rightCategoryIndex) {
      return leftCategoryIndex - rightCategoryIndex;
    }

    const leftOrderIndex = PRECONDITION_ORDER.indexOf(left.preconditionId);
    const rightOrderIndex = PRECONDITION_ORDER.indexOf(right.preconditionId);

    if (leftOrderIndex !== rightOrderIndex) {
      return leftOrderIndex - rightOrderIndex;
    }

    return left.preconditionId.localeCompare(right.preconditionId);
  });
}

function normalizePreconditionResults(results: ExecutionContractPreconditionResult[]): Array<{
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

function normalizeDeliverableScope(scope: DeliverableScope): DeliverableScope {
  return {
    requestedDeliverables: uniqueSorted(scope.requestedDeliverables),
    missionObjective: scope.missionObjective,
    ...(scope.missionTemplateId ? { missionTemplateId: scope.missionTemplateId } : {}),
    scopeTags: uniqueSorted(scope.scopeTags),
    outOfScopeTags: uniqueSorted(scope.outOfScopeTags),
  };
}

function buildPrecondition(input: {
  preconditionId: string;
  category: ExecutionContractPreconditionCategory;
  state: ExecutionContractPreconditionResult['state'];
  reasonTokens?: string[];
  blockingReasons?: string[];
  limitations?: string[];
}): ExecutionContractPreconditionResult {
  return {
    preconditionId: input.preconditionId,
    category: input.category,
    state: input.state,
    reasonTokens: uniqueSorted(input.reasonTokens ?? []),
    blockingReasons: uniqueSorted(input.blockingReasons ?? []),
    limitations: uniqueSorted(input.limitations ?? []),
  };
}

function deriveDeliverableScope(mission: Record<string, unknown> | undefined): DeliverableScope {
  const instance = (mission?.instance ?? {}) as Record<string, unknown>;
  const definition = (mission?.definition ?? {}) as Record<string, unknown>;

  const requestedDeliverables = Array.isArray(instance.requestedDeliverables)
    ? uniqueSorted(instance.requestedDeliverables.flatMap((entry) => {
      if (typeof entry === 'string') {
        return entry.length > 0 ? [entry] : [];
      }
      if (typeof entry === 'object' && entry !== null) {
        const deliverableId = asString((entry as Record<string, unknown>).deliverableId);
        return deliverableId ? [deliverableId] : [];
      }
      return [];
    }))
    : [];

  return {
    requestedDeliverables,
    missionObjective: asString(instance.objective) ?? '',
    ...(asString(instance.missionTemplateId) ? { missionTemplateId: asString(instance.missionTemplateId) as string } : {}),
    scopeTags: uniqueSorted([
      ...asStringArray(definition.tags),
      ...(asString(mission?.missionType) ? [asString(mission?.missionType) as string] : []),
    ]),
    outOfScopeTags: uniqueSorted([
      'external-calls',
      'runtime-execution',
      'scheduling',
      'queueing',
      'swarm-runtime-orchestration',
    ]),
  };
}

function deriveExecutionTarget(input: {
  policy: ExecutionContractPolicy;
  selectedTeamId?: string;
}): ExecutionTarget {
  if (input.policy.executionPolicyId === 'manual-runtime-handoff-only') {
    return 'manual_operator';
  }

  if (!input.selectedTeamId) {
    return 'unassigned_target';
  }

  return 'team_runtime';
}

function deriveDependencySummary(results: ExecutionContractPreconditionResult[]): ExecutionDependencySummary {
  return {
    totalPreconditions: results.length,
    satisfied: results.filter((entry) => entry.state === 'satisfied').length,
    waiting: results.filter((entry) => entry.state === 'waiting').length,
    blocked: results.filter((entry) => entry.state === 'blocked').length,
    incomplete: results.filter((entry) => entry.state === 'incomplete').length,
    inconclusive: results.filter((entry) => entry.state === 'inconclusive').length,
  };
}

function deriveExecutionContractId(input: {
  missionId: string;
  assignmentDecisionId: string;
  activationDecisionId: string;
  preconditionResults: ExecutionContractPreconditionResult[];
  executionPolicyId: string;
  executionTarget: ExecutionTarget;
  deliverableScope: DeliverableScope;
}): string {
  const identityPayload = {
    missionId: input.missionId,
    assignmentDecisionId: input.assignmentDecisionId,
    activationDecisionId: input.activationDecisionId,
    normalizedPreconditionResults: normalizePreconditionResults(input.preconditionResults),
    executionPolicyId: input.executionPolicyId,
    executionTarget: input.executionTarget,
    deliverableScope: normalizeDeliverableScope(input.deliverableScope),
  };

  return sha256(canonicalStringify(identityPayload));
}

export interface ExecutionContractEvaluationResult {
  executionContract: MissionExecutionContract;
}

export function createExecutionContractEvaluator(options: {
  missionProjection?: MissionProjectionEngine;
  assignmentProjection?: MissionAssignmentProjectionEngine;
  activationProjection?: MissionActivationProjectionEngine;
  teamProjection?: TeamProjectionEngine;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
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

  const activationProjection = options.activationProjection ?? createMissionActivationProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
  });

  const teamProjection = options.teamProjection ?? createTeamProjection({
    definitionsDir: options.teamDefinitionsDir,
  });

  function evaluateExecutionContract(input: {
    missionId: string;
    executionPolicyId?: string;
  }): ExecutionContractEvaluationResult {
    const policy = getExecutionContractPolicy(input.executionPolicyId ?? DEFAULT_EXECUTION_CONTRACT_POLICY_ID);

    let mission: Record<string, unknown> | undefined;
    let assignment: Record<string, unknown> | undefined;
    let activation: Record<string, unknown> | undefined;
    let teamStatus: { readinessState?: string; availabilityState?: string } | undefined;

    try {
      mission = missionProjection.projectOne(input.missionId) as unknown as Record<string, unknown>;
    } catch {
      mission = undefined;
    }

    try {
      assignment = assignmentProjection.projectOne({ missionId: input.missionId }) as unknown as Record<string, unknown>;
    } catch {
      assignment = undefined;
    }

    try {
      activation = activationProjection.projectOne({ missionId: input.missionId }) as unknown as Record<string, unknown>;
    } catch {
      activation = undefined;
    }

    const selectedTeamId = asString(assignment?.selectedTeamId);

    if (selectedTeamId) {
      try {
        const projectedTeam = teamProjection.projectOne(selectedTeamId);
        teamStatus = {
          readinessState: projectedTeam.status.readinessState,
          availabilityState: projectedTeam.status.availabilityState,
        };
      } catch {
        teamStatus = undefined;
      }
    }

    const executionTarget = deriveExecutionTarget({
      policy,
      selectedTeamId,
    });

    const missionExistsPrecondition = buildPrecondition({
      preconditionId: 'mission_exists',
      category: 'mission',
      state: mission ? 'satisfied' : 'incomplete',
      reasonTokens: mission ? ['mission_projection_loaded'] : ['mission_projection_missing'],
      limitations: mission ? [] : ['mission_not_found'],
    });

    const assignmentExistsPrecondition = buildPrecondition({
      preconditionId: 'assignment_exists',
      category: 'assignment',
      state: asString(assignment?.assignmentDecisionId) ? 'satisfied' : 'incomplete',
      reasonTokens: asString(assignment?.assignmentDecisionId)
        ? ['assignment_projection_loaded']
        : ['assignment_projection_missing'],
      limitations: asString(assignment?.assignmentDecisionId) ? [] : ['assignment_decision_missing'],
    });

    const assignmentDecisionState = asString(assignment?.decisionState);

    const assignmentConfirmedPrecondition = buildPrecondition({
      preconditionId: 'assignment_confirmed',
      category: 'assignment',
      state: !policy.requiresConfirmedAssignmentDecision
        ? 'satisfied'
        : !assignment
          ? 'incomplete'
          : assignmentDecisionState === 'confirmed'
            ? 'satisfied'
            : assignmentDecisionState === 'blocked' || assignmentDecisionState === 'rejected'
              ? 'blocked'
              : 'waiting',
      reasonTokens: !policy.requiresConfirmedAssignmentDecision
        ? ['assignment_confirmation_not_required']
        : assignmentDecisionState
          ? [`assignment_decision_state:${assignmentDecisionState}`]
          : ['assignment_decision_state:missing'],
      blockingReasons: policy.requiresConfirmedAssignmentDecision
        && (assignmentDecisionState === 'blocked' || assignmentDecisionState === 'rejected')
        ? ['assignment_not_confirmed_hard_block']
        : [],
      limitations: policy.requiresConfirmedAssignmentDecision && assignmentDecisionState !== 'confirmed'
        ? ['assignment_confirmation_pending']
        : [],
    });

    const activationExistsPrecondition = buildPrecondition({
      preconditionId: 'activation_exists',
      category: 'activation',
      state: asString(activation?.activationDecisionId) ? 'satisfied' : 'incomplete',
      reasonTokens: asString(activation?.activationDecisionId)
        ? ['activation_projection_loaded']
        : ['activation_projection_missing'],
      limitations: asString(activation?.activationDecisionId) ? [] : ['activation_decision_missing'],
    });

    const activationState = asString(activation?.activationState);
    const executionReadinessState = asString(activation?.executionReadinessState);

    const activationReadyPrecondition = buildPrecondition({
      preconditionId: 'activation_ready',
      category: 'activation',
      state: !policy.requiresReadyActivationDecision
        ? 'satisfied'
        : !activation
          ? 'incomplete'
          : activationState === 'ready_for_activation'
            ? 'satisfied'
            : activationState === 'blocked' || activationState === 'rejected'
              ? 'blocked'
              : executionReadinessState === 'inconclusive'
                ? 'inconclusive'
                : executionReadinessState === 'incomplete'
                  ? 'incomplete'
                  : 'waiting',
      reasonTokens: !policy.requiresReadyActivationDecision
        ? ['activation_readiness_not_required']
        : [
          `activation_state:${activationState ?? 'missing'}`,
          `activation_execution_readiness:${executionReadinessState ?? 'missing'}`,
        ],
      blockingReasons: policy.requiresReadyActivationDecision
        && (activationState === 'blocked' || activationState === 'rejected')
        ? ['activation_not_ready_hard_block']
        : [],
      limitations: policy.requiresReadyActivationDecision && activationState !== 'ready_for_activation'
        ? ['activation_readiness_pending']
        : [],
    });

    const teamReadiness = asString(teamStatus?.readinessState);
    const teamAvailability = asString(teamStatus?.availabilityState);

    const teamReadyPrecondition = buildPrecondition({
      preconditionId: 'team_ready',
      category: 'team',
      state: !policy.requiresSelectedTeamReady
        ? 'satisfied'
        : !selectedTeamId
          ? 'incomplete'
          : !teamStatus
            ? 'inconclusive'
            : teamReadiness === 'ready'
              ? 'satisfied'
              : teamReadiness === 'blocked'
                ? 'blocked'
                : teamReadiness === 'incomplete'
                  ? 'incomplete'
                  : teamReadiness === 'inconclusive'
                    ? 'inconclusive'
                    : 'waiting',
      reasonTokens: !policy.requiresSelectedTeamReady
        ? ['team_readiness_not_required']
        : [
          `team_readiness:${teamReadiness ?? 'missing'}`,
          `selected_team:${selectedTeamId ?? 'missing'}`,
        ],
      blockingReasons: policy.requiresSelectedTeamReady && teamReadiness === 'blocked'
        ? ['selected_team_not_ready']
        : [],
      limitations: policy.requiresSelectedTeamReady && teamReadiness !== 'ready'
        ? ['selected_team_readiness_pending']
        : [],
    });

    const teamAvailablePrecondition = buildPrecondition({
      preconditionId: 'team_available',
      category: 'team',
      state: !policy.requiresSelectedTeamAvailable
        ? 'satisfied'
        : !selectedTeamId
          ? 'incomplete'
          : !teamStatus
            ? 'inconclusive'
            : teamAvailability === 'available'
              ? 'satisfied'
              : teamAvailability === 'unavailable'
                ? 'blocked'
                : 'waiting',
      reasonTokens: !policy.requiresSelectedTeamAvailable
        ? ['team_availability_not_required']
        : [
          `team_availability:${teamAvailability ?? 'missing'}`,
          `selected_team:${selectedTeamId ?? 'missing'}`,
        ],
      blockingReasons: policy.requiresSelectedTeamAvailable && teamAvailability === 'unavailable'
        ? ['selected_team_unavailable']
        : [],
      limitations: policy.requiresSelectedTeamAvailable && teamAvailability !== 'available'
        ? ['selected_team_availability_pending']
        : [],
    });

    const executionTargetPrecondition = buildPrecondition({
      preconditionId: 'execution_target',
      category: 'execution_target',
      state: !policy.requiresExplicitExecutionTarget
        ? 'satisfied'
        : executionTarget === 'unassigned_target'
          ? 'incomplete'
          : 'satisfied',
      reasonTokens: !policy.requiresExplicitExecutionTarget
        ? ['execution_target_not_required']
        : [`execution_target:${executionTarget}`],
      limitations: policy.requiresExplicitExecutionTarget && executionTarget === 'unassigned_target'
        ? ['execution_target_unresolved']
        : [],
    });

    const runtimeGovernancePrecondition = buildPrecondition({
      preconditionId: 'runtime_governance',
      category: 'runtime_governance',
      state: policy.requiresFounderRuntimeApproval ? 'waiting' : 'satisfied',
      reasonTokens: policy.requiresFounderRuntimeApproval
        ? ['runtime_governance_approval_required']
        : ['runtime_governance_approval_not_required'],
      limitations: policy.requiresFounderRuntimeApproval
        ? ['founder_runtime_approval_pending']
        : [],
    });

    const preconditionResults = sortPreconditions([
      missionExistsPrecondition,
      assignmentExistsPrecondition,
      assignmentConfirmedPrecondition,
      activationExistsPrecondition,
      activationReadyPrecondition,
      teamReadyPrecondition,
      teamAvailablePrecondition,
      executionTargetPrecondition,
      runtimeGovernancePrecondition,
    ]);

    const status = deriveExecutionContractStatus({
      policy,
      preconditionResults,
    });

    const deliverableScope = deriveDeliverableScope(mission);

    const assignmentDecisionId = asString(assignment?.assignmentDecisionId) ?? 'assignment-decision-missing';
    const activationDecisionId = asString(activation?.activationDecisionId) ?? 'activation-decision-missing';

    const executionContractId = deriveExecutionContractId({
      missionId: input.missionId,
      assignmentDecisionId,
      activationDecisionId,
      preconditionResults,
      executionPolicyId: policy.executionPolicyId,
      executionTarget,
      deliverableScope,
    });

    const executionContract: MissionExecutionContract = {
      executionContractId,
      missionId: input.missionId,
      assignmentDecisionId,
      activationDecisionId,
      selectedTeamId: selectedTeamId ?? 'unassigned-team',
      executionPolicyId: policy.executionPolicyId,
      contractState: status.contractState,
      executionEligibilityState: status.executionEligibilityState,
      executionTarget,
      missionType: asString(mission?.missionType) ?? 'unknown',
      missionSummary: asString((mission?.instance as Record<string, unknown> | undefined)?.objective)
        ?? asString(mission?.displayName)
        ?? '',
      deliverableScope: normalizeDeliverableScope(deliverableScope),
      authorizedActions: [...EXECUTION_AUTHORIZED_ACTIONS],
      prohibitedActions: [...EXECUTION_PROHIBITED_ACTIONS],
      dependencySummary: deriveDependencySummary(preconditionResults),
      remainingBlockers: uniqueSorted(status.blockingReasons),
      limitations: uniqueSorted([
        ...status.limitations,
        'execution_contract_projection_only',
        'runtime_engine_not_available_in_sprint_5_1',
      ]),
      runtimeEnvelopeStub: {
        runtimeEnvelopeVersion: '1',
        runtimeTargetKind: executionTarget,
        executionAttemptSupported: false,
        taskGraphSupported: false,
        retryPolicySupported: false,
        resourceBindingSupported: false,
        notes: ['execution contract only; no runtime invocation'],
      },
      createdFrom: ((mission?.instance as Record<string, unknown> | undefined)?.createdFrom ?? { kind: 'unknown' }) as MissionExecutionContract['createdFrom'],
      historyDigest: '',
      preconditionResults,
      reasonTokens: uniqueSorted(status.reasonTokens),
    };

    return {
      executionContract,
    };
  }

  function evaluateAllExecutionContracts(input: { executionPolicyId?: string } = {}): ExecutionContractEvaluationResult[] {
    const policyId = input.executionPolicyId ?? DEFAULT_EXECUTION_CONTRACT_POLICY_ID;

    return missionProjection.projectAll()
      .map((mission) => evaluateExecutionContract({
        missionId: mission.missionId,
        executionPolicyId: policyId,
      }))
      .sort((left, right) => left.executionContract.missionId.localeCompare(right.executionContract.missionId));
  }

  function getPolicy(executionPolicyId?: string): ExecutionContractPolicy {
    return getExecutionContractPolicy(executionPolicyId ?? DEFAULT_EXECUTION_CONTRACT_POLICY_ID);
  }

  return {
    evaluateExecutionContract,
    evaluateAllExecutionContracts,
    getPolicy,
  };
}

export type ExecutionContractEvaluator = ReturnType<typeof createExecutionContractEvaluator>;
