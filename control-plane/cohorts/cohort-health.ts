export interface CohortHealthInput {
  investigationReadinessStates: string[];
  synthesisReadinessStates: string[];
  synthesisConflictCount: number;
  restartCount: number;
}

export interface CohortHealthResult {
  healthState: 'healthy' | 'degraded' | 'conflicted' | 'unstable';
  strengths: string[];
  limitations: string[];
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasIncompleteInvestigations(readinessStates: string[]): boolean {
  return readinessStates.some((state) => state === 'still_evolving' || state === 'blocked' || state === 'inconclusive' || state === 'unhealthy');
}

export function classifyCohortHealth(input: CohortHealthInput): CohortHealthResult {
  const strengths: string[] = [];
  const limitations: string[] = [];

  const incompleteInvestigations = hasIncompleteInvestigations(input.investigationReadinessStates);
  const hasSynthesisConflict = input.synthesisConflictCount > 0 || input.synthesisReadinessStates.some((state) => state === 'inconclusive');
  const unstable = input.restartCount >= 2;

  if (!incompleteInvestigations) {
    strengths.push('investigations complete or stable');
  }
  if (!hasSynthesisConflict) {
    strengths.push('no synthesis contradictions detected');
  }
  if (input.restartCount === 0) {
    strengths.push('no restart churn detected');
  }

  if (incompleteInvestigations) {
    limitations.push('incomplete investigations present');
  }
  if (hasSynthesisConflict) {
    limitations.push('synthesis contradictions detected');
  }
  if (unstable) {
    limitations.push('investigations repeatedly restarting');
  }

  let healthState: CohortHealthResult['healthState'];
  if (unstable) {
    healthState = 'unstable';
  } else if (hasSynthesisConflict) {
    healthState = 'conflicted';
  } else if (incompleteInvestigations) {
    healthState = 'degraded';
  } else {
    healthState = 'healthy';
  }

  return {
    healthState,
    strengths: uniqueSorted(strengths),
    limitations: uniqueSorted(limitations)
  };
}
