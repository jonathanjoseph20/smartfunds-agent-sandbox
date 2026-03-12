import type { MissionCreatedFrom } from '../missions/mission-instance-types.ts';

export const EXECUTION_CONTRACT_STATES = [
  'draft',
  'evaluated',
  'ready_for_runtime_handoff',
  'under_review',
  'blocked',
  'rejected',
  'archived',
] as const;

export const EXECUTION_ELIGIBILITY_STATES = [
  'eligible',
  'waiting_on_runtime_preparation',
  'blocked',
  'incomplete',
  'inconclusive',
] as const;

export const EXECUTION_TARGETS = [
  'team_runtime',
  'swarm_runtime',
  'manual_operator',
  'external_runtime',
  'unassigned_target',
] as const;

export const EXECUTION_CONTRACT_PRECONDITION_STATES = [
  'satisfied',
  'waiting',
  'blocked',
  'incomplete',
  'inconclusive',
] as const;

export const EXECUTION_CONTRACT_PRECONDITION_CATEGORIES = [
  'mission',
  'assignment',
  'activation',
  'team',
  'execution_target',
  'runtime_governance',
] as const;

export const MISSION_EXECUTION_CONTRACT_HISTORY_EVENT_TYPES = [
  'execution_contract_evaluated',
  'execution_contract_ready',
  'execution_contract_blocked',
  'execution_contract_confirmed',
  'execution_contract_rejected',
  'execution_contract_materialized',
] as const;

export const EXECUTION_AUTHORIZED_ACTIONS = [
  'prepare_execution_envelope',
  'accept_runtime_handoff',
  'materialize_runtime_stub',
] as const;

export const EXECUTION_PROHIBITED_ACTIONS = [
  'invoke_team_runtime',
  'schedule_execution',
  'dispatch_tasks',
  'call_external_services',
] as const;

export type ExecutionContractState = typeof EXECUTION_CONTRACT_STATES[number];
export type ExecutionEligibilityState = typeof EXECUTION_ELIGIBILITY_STATES[number];
export type ExecutionTarget = typeof EXECUTION_TARGETS[number];
export type ExecutionContractPreconditionState = typeof EXECUTION_CONTRACT_PRECONDITION_STATES[number];
export type ExecutionContractPreconditionCategory = typeof EXECUTION_CONTRACT_PRECONDITION_CATEGORIES[number];
export type MissionExecutionContractHistoryEventType = typeof MISSION_EXECUTION_CONTRACT_HISTORY_EVENT_TYPES[number];
export type ExecutionAuthorizedAction = typeof EXECUTION_AUTHORIZED_ACTIONS[number];
export type ExecutionProhibitedAction = typeof EXECUTION_PROHIBITED_ACTIONS[number];

export interface ExecutionContractPreconditionResult {
  preconditionId: string;
  category: ExecutionContractPreconditionCategory;
  state: ExecutionContractPreconditionState;
  reasonTokens: string[];
  blockingReasons: string[];
  limitations: string[];
}

export interface DeliverableScope {
  requestedDeliverables: string[];
  missionObjective: string;
  missionTemplateId?: string;
  scopeTags: string[];
  outOfScopeTags: string[];
}

export interface RuntimeEnvelopeStub {
  runtimeEnvelopeVersion: string;
  runtimeTargetKind: ExecutionTarget;
  executionAttemptSupported: boolean;
  taskGraphSupported: boolean;
  retryPolicySupported: boolean;
  resourceBindingSupported: boolean;
  notes: string[];
}

export interface ExecutionDependencySummary {
  totalPreconditions: number;
  satisfied: number;
  waiting: number;
  blocked: number;
  incomplete: number;
  inconclusive: number;
}

export interface MissionExecutionContract {
  executionContractId: string;
  missionId: string;
  assignmentDecisionId: string;
  activationDecisionId: string;
  selectedTeamId: string;
  executionPolicyId: string;
  contractState: ExecutionContractState;
  executionEligibilityState: ExecutionEligibilityState;
  executionTarget: ExecutionTarget;
  missionType: string;
  missionSummary: string;
  deliverableScope: DeliverableScope;
  authorizedActions: ExecutionAuthorizedAction[];
  prohibitedActions: ExecutionProhibitedAction[];
  dependencySummary: ExecutionDependencySummary;
  remainingBlockers: string[];
  limitations: string[];
  runtimeEnvelopeStub: RuntimeEnvelopeStub;
  createdFrom: MissionCreatedFrom;
  historyDigest: string;
  preconditionResults: ExecutionContractPreconditionResult[];
  reasonTokens: string[];
}

export interface MissionExecutionContractHistoryEntry {
  executionContractId: string;
  missionId: string;
  eventType: MissionExecutionContractHistoryEventType;
  eventDedupeKey: string;
  reasoning: string;
  payload: Record<string, unknown>;
}

export interface MissionExecutionContractHistory {
  executionContractId: string;
  missionId: string;
  entries: MissionExecutionContractHistoryEntry[];
}

export interface MissionExecutionContractProjection extends MissionExecutionContract {
  historySummary: {
    totalEvents: number;
    lastEventType?: MissionExecutionContractHistoryEventType;
    lastEventDedupeKey?: string;
  };
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
    historyJsonPath: string;
    preconditionsJsonPath: string;
    runtimeEnvelopeJsonPath: string;
  };
}

export interface MissionExecutionContractMaterializationSummary {
  executionContractId: string;
  missionId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  preconditionsPath: string;
  runtimeEnvelopePath: string;
}
