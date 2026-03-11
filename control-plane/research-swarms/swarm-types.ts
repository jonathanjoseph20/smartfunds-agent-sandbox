export const SWARM_STATES = [
  'inactive',
  'initializing',
  'active',
  'progressing',
  'stabilizing',
  'completed'
] as const;

export const SWARM_READINESS_STATES = [
  'pending',
  'analyzing',
  'coherent',
  'blocked'
] as const;

export const SWARM_HISTORY_EVENT_TYPES = [
  'swarm_activated',
  'investigation_linked',
  'swarm_progressed',
  'swarm_stabilizing',
  'swarm_completed'
] as const;

export type SwarmState = typeof SWARM_STATES[number];
export type SwarmReadinessState = typeof SWARM_READINESS_STATES[number];
export type SwarmHistoryEventType = typeof SWARM_HISTORY_EVENT_TYPES[number];

export interface SwarmCompletionRules {
  requireAllInvestigationsComplete: boolean;
  requireResolvedConflicts: boolean;
}

export interface SwarmDefinition {
  swarmId: string;
  displayName: string;
  teamId: string;
  investigationTemplates: string[];
  completionRules: SwarmCompletionRules;
}

export interface SwarmReadiness {
  swarmId: string;
  readiness: SwarmReadinessState;
  blockingReasons: string[];
  strengths: string[];
  limitations: string[];
  expectedInvestigationCount: number;
  linkedInvestigationCount: number;
  synthesisReadyCount: number;
  unresolvedConflictCount: number;
}

export interface SwarmCompletion {
  swarmId: string;
  isComplete: boolean;
  allInvestigationsComplete: boolean;
  conflictsResolved: boolean;
  completedInvestigationCount: number;
  totalInvestigationCount: number;
  unresolvedConflictCount: number;
  unmetRules: string[];
}

export interface SwarmStatus {
  swarmId: string;
  teamId: string;
  state: SwarmState;
  readiness: SwarmReadiness;
  completion: SwarmCompletion;
  linkedInvestigationIds: string[];
  linkedSynthesisIds: string[];
}

export interface SwarmHistoryEntry {
  swarmId: string;
  eventType: SwarmHistoryEventType;
  reason: string;
  eventDedupeKey: string;
  linkedInvestigationIds: string[];
  linkedSynthesisIds: string[];
  state?: SwarmState;
  readiness?: SwarmReadinessState;
  slotReference?: string;
}

export interface SwarmHistory {
  swarmId: string;
  entries: SwarmHistoryEntry[];
}

export interface SwarmProjection {
  swarmId: string;
  teamId: string;
  investigations: Array<{
    investigationRunId: string;
    investigationDefinitionId: string;
    status: string;
  }>;
  syntheses: Array<{
    synthesisId: string;
    readinessState: string;
    unresolvedConflictCount: number;
  }>;
  state: SwarmState;
  readiness: SwarmReadiness;
  completion: SwarmCompletion;
  historySummary: {
    totalEvents: number;
    lastEventType?: SwarmHistoryEventType;
    lastEventDedupeKey?: string;
  };
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
}

export class SwarmError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SwarmError';
    this.code = code;
  }
}
