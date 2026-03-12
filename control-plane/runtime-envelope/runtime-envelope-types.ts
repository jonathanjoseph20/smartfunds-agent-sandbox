export const RUNTIME_ENVELOPE_STATES = [
  'draft',
  'evaluated',
  'ready_for_runtime',
  'under_review',
  'blocked',
  'rejected',
  'archived',
] as const;

export const RUNTIME_ENVELOPE_ELIGIBILITY_STATES = [
  'eligible',
  'waiting_on_runtime_support',
  'blocked',
  'incomplete',
  'inconclusive',
] as const;

export const EXECUTION_TARGET_KINDS = [
  'team_runtime',
  'swarm_runtime',
  'manual_operator',
  'external_runtime',
  'unassigned_target',
] as const;

export const MISSION_RUNTIME_ENVELOPE_HISTORY_EVENT_TYPES = [
  'runtime_envelope_evaluated',
  'runtime_envelope_ready',
  'runtime_envelope_blocked',
  'runtime_envelope_confirmed',
  'runtime_envelope_rejected',
  'runtime_envelope_materialized',
] as const;

export const RUNTIME_ENVELOPE_EVALUATION_ERROR_CODES = [
  'EXECUTION_CONTRACT_NOT_FOUND',
  'CONTRACT_NOT_ELIGIBLE',
  'UNSUPPORTED_RUNTIME_TARGET',
  'INVALID_RUNTIME_PAYLOAD',
  'RUNTIME_POLICY_DISABLED',
  'RUNTIME_ENVELOPE_NOT_FOUND',
] as const;

export type RuntimeEnvelopeState = typeof RUNTIME_ENVELOPE_STATES[number];
export type RuntimeEnvelopeEligibility = typeof RUNTIME_ENVELOPE_ELIGIBILITY_STATES[number];
export type ExecutionTargetKind = typeof EXECUTION_TARGET_KINDS[number];
export type MissionRuntimeEnvelopeHistoryEventType = typeof MISSION_RUNTIME_ENVELOPE_HISTORY_EVENT_TYPES[number];
export type RuntimeEnvelopeEvaluationErrorCode = typeof RUNTIME_ENVELOPE_EVALUATION_ERROR_CODES[number];

export interface RuntimePayload {
  missionSummary: string;
  deliverableScope: string[];
  scopeTags: string[];
  outOfScopeTags: string[];
  authorizedTeamId: string;
  executionPolicyId: string;
}

export interface RuntimeCapabilities {
  supportsTaskGraph: boolean;
  supportsRetries: boolean;
  supportsResourceBinding: boolean;
  supportsExternalAPIs: boolean;
  supportsParallelExecution: boolean;
  supportsAgentInvocation: boolean;
}

export interface TaskGraphStub {
  supported: boolean;
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
}

export interface ResourceBindingStub {
  computeRequired: boolean;
  apiAccessRequired: boolean;
  llmInferenceRequired: boolean;
  storageRequired: boolean;
}

export interface RuntimeEnvelopeProvenance {
  executionContractState: string;
  executionEligibilityState: string;
  contractReasonTokens: string[];
  contractLimitations: string[];
  contractBlockers: string[];
}

export interface MissionRuntimeEnvelope {
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  selectedTeamId: string;

  executionTarget: ExecutionTargetKind;

  runtimePayload: RuntimePayload;
  runtimeCapabilities: RuntimeCapabilities;
  taskGraphStub: TaskGraphStub;
  resourceBindings: ResourceBindingStub;

  envelopeState: RuntimeEnvelopeState;
  envelopeEligibility: RuntimeEnvelopeEligibility;

  limitations: string[];
  blockers: string[];

  provenanceInputs: RuntimeEnvelopeProvenance;
}

export interface MissionRuntimeEnvelopeHistoryEntry {
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  eventType: MissionRuntimeEnvelopeHistoryEventType;
  eventDedupeKey: string;
  reasoning: string;
  payload: Record<string, unknown>;
}

export interface MissionRuntimeEnvelopeHistory {
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  entries: MissionRuntimeEnvelopeHistoryEntry[];
}

export interface MissionRuntimeEnvelopeProjection extends MissionRuntimeEnvelope {
  historyDigest: string;
  historySummary: {
    totalEvents: number;
    lastEventType?: MissionRuntimeEnvelopeHistoryEventType;
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
    payloadJsonPath: string;
    capabilitiesJsonPath: string;
  };
}

export interface MissionRuntimeEnvelopeMaterializationSummary {
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  payloadPath: string;
  capabilitiesPath: string;
}
