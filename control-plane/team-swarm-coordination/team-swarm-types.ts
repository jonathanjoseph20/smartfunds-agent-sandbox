export const TEAM_SWARM_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export const TEAM_SWARM_LIFECYCLE_STATES = ['inactive', 'activated', 'progressing', 'stabilizing', 'completed'] as const;
export const TEAM_SWARM_READINESS_STATES = ['pending', 'analyzing', 'coherent', 'blocked'] as const;
export const TEAM_SWARM_TOPIC_PROGRESS_STATES = ['pending', 'active', 'stabilizing', 'stabilized'] as const;

export const TEAM_SWARM_HISTORY_EVENT_TYPES = [
  'swarm_activated',
  'swarm_prioritized',
  'swarm_progressed',
  'swarm_stabilizing',
  'swarm_completed'
] as const;

export type TeamSwarmPriority = typeof TEAM_SWARM_PRIORITIES[number];
export type TeamSwarmLifecycleState = typeof TEAM_SWARM_LIFECYCLE_STATES[number];
export type TeamSwarmReadinessState = typeof TEAM_SWARM_READINESS_STATES[number];
export type TeamSwarmTopicProgressState = typeof TEAM_SWARM_TOPIC_PROGRESS_STATES[number];
export type TeamSwarmHistoryEventType = typeof TEAM_SWARM_HISTORY_EVENT_TYPES[number];

export type TeamSwarmRegistryRecord = {
  teamId: string;
  teamDisplayName: string;
  teamEnabled: boolean;
  swarmId: string;
  swarmDisplayName: string;
  investigationTemplates: string[];
};

export type TeamSwarmActivationEvaluation = {
  teamId: string;
  swarmId: string;
  activated: boolean;
  reasons: string[];
};

export type TeamSwarmPriorityEvaluation = {
  teamId: string;
  swarmId: string;
  priority: TeamSwarmPriority;
  reasons: string[];
  appliedRule: 'conflicted' | 'critical_escalation' | 'escalated' | 'failure' | 'blocked' | 'default';
};

export type TeamSwarmReadinessEvaluation = {
  teamId: string;
  swarmId: string;
  readiness: TeamSwarmReadinessState;
  reasons: string[];
};

export type TeamSwarmCompletionEvaluation = {
  teamId: string;
  swarmId: string;
  isComplete: boolean;
  unmetRequirements: string[];
  completedInvestigationCount: number;
  totalInvestigationCount: number;
  unresolvedConflictCount: number;
};

export type TeamSwarmStatusRecord = {
  teamId: string;
  swarmId: string;
  swarmDisplayName: string;
  activation: TeamSwarmActivationEvaluation;
  priority: TeamSwarmPriorityEvaluation;
  readiness: TeamSwarmReadinessEvaluation;
  lifecycle: TeamSwarmLifecycleState;
  completion: TeamSwarmCompletionEvaluation;
  linkedInvestigationIds: string[];
  linkedSynthesisIds: string[];
  reasons: string[];
};

export type TeamSwarmTopicProgress = {
  teamId: string;
  progress: TeamSwarmTopicProgressState;
  reasons: string[];
  totalSwarms: number;
  activatedSwarms: number;
  completedSwarms: number;
  stabilizingSwarms: number;
};

export type TeamSwarmHistoryEntry = {
  teamId: string;
  swarmId: string;
  eventType: TeamSwarmHistoryEventType;
  reason: string;
  eventDedupeKey: string;
  priority: TeamSwarmPriority;
  lifecycle: TeamSwarmLifecycleState;
  readiness: TeamSwarmReadinessState;
  linkedInvestigationIds: string[];
  linkedSynthesisIds: string[];
  slotReference?: string;
};

export type TeamSwarmHistory = {
  teamId: string;
  entries: TeamSwarmHistoryEntry[];
};

export type TeamSwarmProjection = {
  teamId: string;
  teamDisplayName: string;
  linkedSwarms: TeamSwarmStatusRecord[];
  topicProgress: TeamSwarmTopicProgress;
  summary: {
    totalSwarms: number;
    activeSwarms: number;
    completedSwarms: number;
    blockedSwarms: number;
  };
  historySummary: {
    totalEvents: number;
    lastEventType?: TeamSwarmHistoryEventType;
    lastEventDedupeKey?: string;
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
};

export class TeamSwarmError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TeamSwarmError';
    this.code = code;
  }
}
