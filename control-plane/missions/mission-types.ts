import type {
  CapabilityClass,
  MutationIntent,
  PolicyProfile,
  TargetScope
} from '../policy/types.ts';

export type MissionPriority = 'low' | 'medium' | 'high' | 'critical';

export type MissionParameterSchema = {
  allowed?: string[];
  required?: string[];
  defaults?: Record<string, string>;
  descriptions?: Record<string, string>;
};

export type MissionDefinition = {
  missionId: string;
  name?: string;
  projectId: string;
  teamId: string;
  workflowId: string;
  objective: string;
  successCriteria: string[];
  deliverables: string[];
  initialContext: Record<string, unknown>;
  profile?: PolicyProfile;
  mutationIntent?: MutationIntent;
  requestedCapabilities?: CapabilityClass[];
  targetScope?: TargetScope;
  parameterSchema?: MissionParameterSchema;
  description?: string;
  priority?: MissionPriority;
  constraints?: string[];
  deadlineHint?: string;
  tags?: string[];
  owner?: string;
  notes?: string;
};

export type MissionExecutionSeed = {
  missionId: string;
  teamId: string;
  agentRoster: string[];
};

export type MissionRunResult = {
  mission: MissionDefinition;
  teamId: string;
  workflowId: string;
  agentRoster: string[];
  runSummary: {
    runId: string;
    status: string;
    currentPhase: string | null;
    completedPhases: string[];
    eventCount: number;
  };
};

export const MISSION_LIFECYCLE_STATES = [
  'draft',
  'approved',
  'active',
  'blocked',
  'completed',
  'archived'
] as const;

export const MISSION_APPROVAL_STATES = [
  'pending_review',
  'approved',
  'rejected',
  'not_required'
] as const;

export const MISSION_READINESS_STATES = [
  'pending',
  'ready',
  'blocked',
  'incomplete',
  'inconclusive'
] as const;

export const MISSION_COMPLETION_STATES = [
  'not_started',
  'in_progress',
  'deliverables_pending',
  'completed',
  'inconclusive'
] as const;

export const MISSION_HISTORY_EVENT_TYPES = [
  'mission_created',
  'mission_approved',
  'mission_activated',
  'mission_blocked',
  'mission_completed',
  'mission_archived',
  'deliverables_declared',
  'source_reference_added'
] as const;

export type MissionLifecycleState = typeof MISSION_LIFECYCLE_STATES[number];
export type MissionApprovalState = typeof MISSION_APPROVAL_STATES[number];
export type MissionReadinessState = typeof MISSION_READINESS_STATES[number];
export type MissionCompletionState = typeof MISSION_COMPLETION_STATES[number];
export type MissionHistoryEventType = typeof MISSION_HISTORY_EVENT_TYPES[number];

export interface DeliverableDescriptor {
  deliverableId: string;
  description?: string;
  satisfied?: boolean;
}

export interface SourceReference {
  sourceKind: string;
  sourceId: string;
  reference: string;
  title?: string;
}

export interface MissionStatus {
  missionId: string;
  approvalState: MissionApprovalState;
  lifecycleState: MissionLifecycleState;
  readinessState: MissionReadinessState;
  completionState: MissionCompletionState;
  blockingReasons: string[];
  limitations: string[];
}

export interface MissionHistoryEntry {
  missionId: string;
  eventType: MissionHistoryEventType;
  eventDedupeKey: string;
  payload: Record<string, unknown>;
  reasoning: string;
  slotReference?: string;
}

export interface MissionProjection {
  missionId: string;
  missionType: string;
  displayName: string;
  definition: Record<string, unknown>;
  instance: Record<string, unknown>;
  status: MissionStatus;
  historySummary: {
    totalEvents: number;
    lastEventType?: MissionHistoryEventType;
  };
  deliverableSummary: {
    totalRequested: number;
    satisfied: number;
    pending: number;
  };
  linkedUpstreamObjects: {
    linkedActionPlanIds: string[];
    linkedPortfolioIds: string[];
    linkedMarketSynthesisIds: string[];
  };
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    historyJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
  };
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}
