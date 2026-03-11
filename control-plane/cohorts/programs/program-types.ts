export const COHORT_PROGRAM_CADENCES = ['hourly', 'daily', 'weekly', 'signal_driven'] as const;
export const COHORT_PROGRAM_LIFECYCLE_STATES = ['pending', 'active', 'paused', 'completed'] as const;
export const COHORT_LIFECYCLE_STATES = ['inactive', 'monitoring', 'investigating', 'escalated', 'stable'] as const;
export const PROGRAM_LAUNCH_CONDITION_KINDS = ['cadence', 'signal_type', 'cohort_health'] as const;

export type CohortProgramCadence = typeof COHORT_PROGRAM_CADENCES[number];
export type CohortProgramLifecycleState = typeof COHORT_PROGRAM_LIFECYCLE_STATES[number];
export type CohortLifecycleState = typeof COHORT_LIFECYCLE_STATES[number];
export type ProgramLaunchConditionKind = typeof PROGRAM_LAUNCH_CONDITION_KINDS[number];

export type ProgramLaunchCondition =
  | { kind: 'cadence' }
  | { kind: 'signal_type'; signalType: string }
  | { kind: 'cohort_health'; health: 'degraded' | 'conflicted' | 'unstable' };

export type CohortProgramDefinition = {
  programId: string;
  cohortId: string;
  displayName: string;
  description?: string;
  cadence: CohortProgramCadence;
  enabled: boolean;
  lifecycleState: CohortProgramLifecycleState;
  investigationTemplates: string[];
  launchConditions: ProgramLaunchCondition[];
};

export type ProgramCadenceEvaluation = {
  cadence: CohortProgramCadence;
  currentSlot: string;
  cadenceDue: boolean;
  cadenceReason:
    | 'cadence_due'
    | 'already_executed_for_slot'
    | 'cadence_not_due'
    | 'signal_driven_cadence';
};

export type ProgramLaunchEligibility = {
  programId: string;
  cohortId: string;
  currentSlot: string;
  lifecycleState: CohortProgramLifecycleState;
  eligible: boolean;
  matchedConditionKinds: ProgramLaunchConditionKind[];
  reason:
    | 'not_eligible_lifecycle_state'
    | 'no_matching_conditions'
    | 'eligible';
};

export type ProgramLaunchCandidate = {
  programId: string;
  cohortId: string;
  currentSlot: string;
  conditionKind: ProgramLaunchConditionKind;
  investigationTemplate: string;
  launchDedupeKey: string;
};

export type ProgramLaunchRecord = {
  launchDedupeKey: string;
  conditionKind: ProgramLaunchConditionKind;
  investigationTemplate: string;
  sourceSignalType: string;
  sourceSignalDedupeKey: string;
  status: 'started' | 'duplicate' | 'failed' | 'skipped';
  investigationRunId?: string;
  note?: string;
};

export type ProgramExecutionHistoryEntry = {
  evaluatedSlot: string;
  logDate: string;
  lifecycleState: CohortProgramLifecycleState;
  matchedConditionKinds: ProgramLaunchConditionKind[];
  launches: ProgramLaunchRecord[];
};

export type ProgramExecutionHistory = {
  cohortId: string;
  programId: string;
  entries: ProgramExecutionHistoryEntry[];
};

export class CohortProgramError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CohortProgramError';
    this.code = code;
  }
}
