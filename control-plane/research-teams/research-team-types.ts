export type ResearchTeamAttachmentRules = {
  cohortIds?: string[];
  cohortTypes?: string[];
  subjectFamilies?: string[];
  topicCategories?: string[];
};

export interface ResearchTeam {
  teamId: string;
  displayName: string;
  teamType: string;
  enabled: boolean;
  attachmentRules: ResearchTeamAttachmentRules;
}

export interface ResearchTeamAttachmentContext {
  cohortId: string;
  cohortType: string;
  subjectKey: string;
}

export interface ResearchTeamAttachment {
  teamId: string;
  cohortId: string;
  attachmentReason: string[];
}

export interface ResearchTeamStatus {
  teamId: string;
  activityState:
    | 'inactive'
    | 'monitoring'
    | 'active_response'
    | 'escalated_response'
    | 'stable'
    | 'paused';
  healthState:
    | 'healthy'
    | 'active'
    | 'overloaded'
    | 'conflicted'
    | 'unstable'
    | 'idle';
  linkedCohortIds: string[];
  linkedProgramIds: string[];
  linkedInvestigationIds: string[];
  linkedSynthesisIds: string[];
  responseReasons: string[];
}

export interface ResearchTeamHistoryEntry {
  teamId: string;
  eventType:
    | 'team_attached'
    | 'team_activated'
    | 'team_deactivated'
    | 'team_escalated'
    | 'team_stabilized';
  linkedCohortIds?: string[];
  linkedInvestigationIds?: string[];
  reason: string;
  slotReference?: string;
  eventDedupeKey: string;
}

export interface ResearchTeamHistory {
  teamId: string;
  entries: ResearchTeamHistoryEntry[];
}

export interface ResearchTeamProjection {
  team: ResearchTeam;
  attachments: ResearchTeamAttachment[];
  status: ResearchTeamStatus;
  linkedPrograms: Array<{ cohortId: string; programId: string }>;
  linkedInvestigations: string[];
  linkedSyntheses: string[];
}

export class ResearchTeamError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ResearchTeamError';
    this.code = code;
  }
}
