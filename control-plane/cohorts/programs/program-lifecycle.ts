import type { ResearchCohort } from '../cohort-types.ts';

import type { CohortProgramDefinition, CohortProgramLifecycleState, CohortLifecycleState, ProgramExecutionHistoryEntry } from './program-types.ts';

const INVESTIGATING_STATUSES = ['pending', 'running', 'awaiting_data', 'scheduled_resume', 'retry_pending', 'blocked'] as const;

function hasActiveInvestigations(statuses: string[]): boolean {
  return statuses.some((status) => (INVESTIGATING_STATUSES as readonly string[]).includes(status));
}

function hasHealthySteadyState(healthState: ResearchCohort['healthState']): boolean {
  return healthState === 'healthy';
}

function sortStates(states: CohortProgramLifecycleState[]): CohortProgramLifecycleState[] {
  return [...states].sort((left, right) => left.localeCompare(right));
}

export function projectProgramLifecycleState(input: {
  definition: CohortProgramDefinition;
  historyEntries: ProgramExecutionHistoryEntry[];
}): CohortProgramLifecycleState {
  if (input.definition.lifecycleState === 'completed') {
    return 'completed';
  }

  if (!input.definition.enabled || input.definition.lifecycleState === 'paused') {
    return 'paused';
  }

  if (input.historyEntries.length === 0 || input.definition.lifecycleState === 'pending') {
    return 'pending';
  }

  return 'active';
}

export function projectCohortLifecycleState(input: {
  programLifecycleStates: CohortProgramLifecycleState[];
  cohortHealthState: ResearchCohort['healthState'];
  linkedInvestigationStatuses: string[];
  escalationConditionSatisfied: boolean;
}): CohortLifecycleState {
  const states = sortStates(input.programLifecycleStates);
  const hasActiveProgram = states.includes('active');
  const hasOnlyInactivePrograms = states.length === 0 || states.every((state) => state === 'pending' || state === 'paused');

  if (hasOnlyInactivePrograms && !hasActiveInvestigations(input.linkedInvestigationStatuses)) {
    return 'inactive';
  }

  if (hasActiveInvestigations(input.linkedInvestigationStatuses)) {
    return 'investigating';
  }

  if (input.escalationConditionSatisfied) {
    return 'escalated';
  }

  if (hasActiveProgram && hasHealthySteadyState(input.cohortHealthState)) {
    return 'stable';
  }

  if (hasActiveProgram) {
    return 'monitoring';
  }

  return 'inactive';
}
