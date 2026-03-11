export const COHORT_ESCALATION_STATES = ['none', 'elevated', 'escalated', 'critical'] as const;

export type CohortEscalationState = typeof COHORT_ESCALATION_STATES[number];

export type CohortEscalationProjection = {
  cohortId: string;
  escalationState: CohortEscalationState;
  escalationReasons: string[];
  linkedSignals: string[];
  linkedSyntheses: string[];
  linkedInvestigations: string[];
  linkedProgramIds: string[];
  slotOrReference: string;
};

export type CohortEscalationHistoryEntry = {
  cohortId: string;
  priorEscalationState: CohortEscalationState;
  nextEscalationState: CohortEscalationState;
  transitionReasons: string[];
  linkedSignals: string[];
  linkedSyntheses: string[];
  linkedInvestigations: string[];
  slotOrReference: string;
  transitionDedupeKey: string;
};

export type CohortEscalationHistory = {
  cohortId: string;
  entries: CohortEscalationHistoryEntry[];
};
