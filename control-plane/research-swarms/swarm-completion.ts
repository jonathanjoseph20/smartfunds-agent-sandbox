import type { SwarmCompletion, SwarmCompletionRules } from './swarm-types.ts';

interface CompletionInvestigation {
  investigationRunId: string;
  status: string;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isInvestigationComplete(status: string): boolean {
  return status === 'completed';
}

export function evaluateCompletionRules(input: {
  swarmId: string;
  completionRules: SwarmCompletionRules;
  investigations: CompletionInvestigation[];
  unresolvedConflictCount: number;
}): SwarmCompletion {
  const investigations = [...input.investigations].sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));
  const totalInvestigationCount = investigations.length;
  const completedInvestigationCount = investigations.filter((entry) => isInvestigationComplete(entry.status)).length;
  const allInvestigationsComplete = totalInvestigationCount > 0 && completedInvestigationCount === totalInvestigationCount;
  const conflictsResolved = input.unresolvedConflictCount === 0;

  const unmetRules: string[] = [];

  if (input.completionRules.requireAllInvestigationsComplete && !allInvestigationsComplete) {
    unmetRules.push('requireAllInvestigationsComplete');
  }
  if (input.completionRules.requireResolvedConflicts && !conflictsResolved) {
    unmetRules.push('requireResolvedConflicts');
  }

  return {
    swarmId: input.swarmId,
    isComplete: unmetRules.length === 0 && totalInvestigationCount > 0,
    allInvestigationsComplete,
    conflictsResolved,
    completedInvestigationCount,
    totalInvestigationCount,
    unresolvedConflictCount: input.unresolvedConflictCount,
    unmetRules: uniqueSorted(unmetRules)
  };
}

export function isSwarmComplete(input: {
  swarmId: string;
  completionRules: SwarmCompletionRules;
  investigations: CompletionInvestigation[];
  unresolvedConflictCount: number;
}): boolean {
  return evaluateCompletionRules(input).isComplete;
}
