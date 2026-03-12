import type {
  TeamAvailabilityState,
  TeamLifecycleState,
  TeamOperatingMode,
  TeamReadinessState,
  TeamRosterPolicyType,
  TeamType,
} from './team-types.ts';

export interface TeamRosterPolicy {
  type: TeamRosterPolicyType;
  minAgents: number;
  maxAgents: number;
  requiredCapabilities: string[];
}

export interface TeamDefinition {
  teamId: string;
  displayName: string;
  description: string;
  teamType: TeamType;
  purpose: string;
  domainTags: string[];
  supportedMissionTypes: string[];
  supportedTemplateIds: string[];
  capabilityTags: string[];
  defaultOperatingMode: TeamOperatingMode;
  lifecycleState: TeamLifecycleState;
  availabilityState: TeamAvailabilityState;
  readinessState: TeamReadinessState;
  rosterPolicy: TeamRosterPolicy;
  notes: string[];
}

export interface TeamValidationIssue {
  teamId: string;
  field: string;
  code: string;
  message: string;
}

export interface TeamStatusProjection {
  teamId: string;
  lifecycleState: TeamLifecycleState;
  availabilityState: TeamAvailabilityState;
  readinessState: TeamReadinessState;
  blockingReasons: string[];
  limitations: string[];
}

export interface TeamSummary {
  teamId: string;
  displayName: string;
  teamType: TeamType;
  defaultOperatingMode: TeamOperatingMode;
  lifecycleState: TeamLifecycleState;
  availabilityState: TeamAvailabilityState;
  readinessState: TeamReadinessState;
}

export type TeamHistoryEventType =
  | 'team_defined'
  | 'team_activated'
  | 'team_marked_dormant'
  | 'team_archived'
  | 'team_availability_changed'
  | 'team_capability_updated';

export interface TeamHistoryEvent {
  teamId: string;
  eventType: TeamHistoryEventType;
  eventDedupeKey: string;
  sequence: number;
  reasoning: string;
  payload: Record<string, unknown>;
}

export interface TeamProjection {
  teamId: string;
  definition: TeamDefinition;
  validation: {
    valid: boolean;
    issues: TeamValidationIssue[];
  };
  status: TeamStatusProjection;
  history: {
    teamId: string;
    entries: TeamHistoryEvent[];
  };
  summary: TeamSummary;
}

export interface TeamMaterializationSummary {
  teamId: string;
  statusPath: string;
  historyPath: string;
  reportPath: string;
  markdownPath: string;
}
