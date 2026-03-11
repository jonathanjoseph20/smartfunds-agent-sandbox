export interface ResearchCohort {
  cohortId: string;
  cohortType: string;
  subjectKey: string;

  linkedInvestigations: string[];
  linkedSyntheses: string[];

  readinessState:
    | 'pending'
    | 'active'
    | 'incomplete'
    | 'inconclusive'
    | 'ready'
    | 'completed';

  healthState:
    | 'healthy'
    | 'degraded'
    | 'conflicted'
    | 'unstable';

  strengths: string[];
  limitations: string[];
}

export interface CohortLinkRules {
  sharedProtocol: boolean;
  sharedAsset: boolean;
  sharedEventFamily: boolean;
  sharedTriggerFamily: boolean;
  cohortDefinitionMatch: boolean;
}

export interface CohortDefinition {
  cohortId: string;
  cohortType: string;
  subjectKey: string;
  linkRules: CohortLinkRules;
}

export class CohortError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CohortError';
    this.code = code;
  }
}
