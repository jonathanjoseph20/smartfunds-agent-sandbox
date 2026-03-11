export interface CohortReadinessInput {
  linkedInvestigationIds: string[];
  linkedSynthesisIds: string[];
  investigationStatuses: string[];
  investigationReadinessStates: string[];
  synthesisReadinessStates: string[];
  synthesisConflictCount: number;
  limitations: string[];
}

export interface CohortReadinessResult {
  readinessState:
    | 'pending'
    | 'active'
    | 'incomplete'
    | 'inconclusive'
    | 'ready'
    | 'completed';
  strengths: string[];
  limitations: string[];
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasIncompleteInvestigations(readinessStates: string[]): boolean {
  return readinessStates.some((state) => state === 'still_evolving' || state === 'blocked' || state === 'inconclusive' || state === 'unhealthy');
}

function hasRunningInvestigations(statuses: string[]): boolean {
  return statuses.some((status) => status === 'pending' || status === 'running' || status === 'awaiting_data' || status === 'scheduled_resume' || status === 'retry_pending');
}

function hasReadySynthesis(states: string[]): boolean {
  return states.some((state) => state === 'ready' || state === 'completed');
}

function hasCompletedSynthesis(states: string[]): boolean {
  return states.length > 0 && states.every((state) => state === 'completed');
}

function hasConflictedSynthesis(states: string[]): boolean {
  return states.some((state) => state === 'inconclusive');
}

export function evaluateCohortReadiness(input: CohortReadinessInput): CohortReadinessResult {
  const strengths: string[] = [];
  const limitations: string[] = [...input.limitations];

  const linkedInvestigationCount = input.linkedInvestigationIds.length;
  const linkedSynthesisCount = input.linkedSynthesisIds.length;
  const incompleteInvestigations = hasIncompleteInvestigations(input.investigationReadinessStates);
  const runningInvestigations = hasRunningInvestigations(input.investigationStatuses);
  const readySynthesis = hasReadySynthesis(input.synthesisReadinessStates);
  const completedSynthesis = hasCompletedSynthesis(input.synthesisReadinessStates);
  const conflictedSynthesis = hasConflictedSynthesis(input.synthesisReadinessStates) || input.synthesisConflictCount > 0;

  if (linkedInvestigationCount > 0) {
    strengths.push(`linked investigations: ${String(linkedInvestigationCount)}`);
  }
  if (linkedSynthesisCount > 0) {
    strengths.push(`linked syntheses: ${String(linkedSynthesisCount)}`);
  }
  if (readySynthesis) {
    strengths.push('synthesis readiness present');
  }

  if (incompleteInvestigations) {
    limitations.push('incomplete investigations present');
  }
  if (conflictedSynthesis) {
    limitations.push('synthesis conflicts present');
  }

  let readinessState: CohortReadinessResult['readinessState'];

  if (linkedInvestigationCount === 0) {
    readinessState = 'pending';
  } else if (incompleteInvestigations) {
    readinessState = 'incomplete';
  } else if (runningInvestigations) {
    readinessState = 'active';
  } else if (conflictedSynthesis) {
    readinessState = 'inconclusive';
  } else if (completedSynthesis) {
    readinessState = 'completed';
  } else if (readySynthesis) {
    readinessState = 'ready';
  } else {
    readinessState = 'incomplete';
  }

  return {
    readinessState,
    strengths: uniqueSorted(strengths),
    limitations: uniqueSorted(limitations)
  };
}
