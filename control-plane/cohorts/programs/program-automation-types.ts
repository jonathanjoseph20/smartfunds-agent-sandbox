import type { CohortEscalationState } from './program-types.ts';

export const PROGRAM_AUTOMATION_EVALUATION_STATES = [
  'due',
  'not_due',
  'signal_match',
  'health_match',
  'escalation_match',
  'deduped',
  'launched',
  'suppressed'
] as const;

export type ProgramAutomationEvaluationState = typeof PROGRAM_AUTOMATION_EVALUATION_STATES[number];

export type ProgramAutomationStatus = {
  programId: string;
  cohortId: string;
  evaluationState: ProgramAutomationEvaluationState;
  triggerReasons: string[];
  triggeringConditionTypes: string[];
  lastRunSlot?: string;
  lastSignalReferences?: string[];
  launchedInvestigationIds?: string[];
  dedupeKey?: string;
  currentEscalationState: CohortEscalationState;
  launchDedupeResult?: string;
};

export type ProgramAutomationHistoryEntry = {
  programId: string;
  cohortId: string;
  slotOrSignalRef: string;
  evaluationOutcome: ProgramAutomationEvaluationState;
  launched: boolean;
  launchedInvestigationIds: string[];
  triggerReason: string[];
  triggeringConditionTypes: string[];
  launchDedupeResult?: string;
  dedupeKey: string;
};

export type ProgramAutomationHistory = {
  cohortId: string;
  programId: string;
  entries: ProgramAutomationHistoryEntry[];
};

export type ProgramAutomationEvaluationResult = {
  status: ProgramAutomationStatus;
  historyAppended: boolean;
};
