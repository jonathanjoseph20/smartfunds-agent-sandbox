import type {
  LinkedInvestigationProjection,
  SynthesisConfidenceSummary,
  SynthesisConflict
} from './synthesis-types.ts';

function clampScore(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

function bandForScore(score: number): SynthesisConfidenceSummary['overallBand'] {
  if (score >= 70) {
    return 'high';
  }
  if (score >= 45) {
    return 'medium';
  }
  return 'low';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isCompletedOrReady(row: LinkedInvestigationProjection): boolean {
  if (row.status === 'completed') {
    return true;
  }
  return row.readinessState === 'complete' || row.readinessState === 'ready_to_finalize';
}

function isIncomplete(row: LinkedInvestigationProjection): boolean {
  return !isCompletedOrReady(row);
}

export function computeSynthesisConfidence(input: {
  linkedInvestigations: LinkedInvestigationProjection[];
  reinforcingInvestigationIds: string[];
  conflicts: SynthesisConflict[];
  unresolvedLimitations: string[];
}): SynthesisConfidenceSummary {
  const total = input.linkedInvestigations.length;
  const completedCount = input.linkedInvestigations.filter(isCompletedOrReady).length;
  const incompleteCount = input.linkedInvestigations.filter(isIncomplete).length;
  const highCount = input.linkedInvestigations.filter((entry) => entry.reportConfidenceBand === 'high').length;
  const mediumCount = input.linkedInvestigations.filter((entry) => entry.reportConfidenceBand === 'medium').length;
  const conflictCount = input.conflicts.length;
  const reinforcingCount = input.reinforcingInvestigationIds.length;

  let score = 35;
  score += Math.min(30, completedCount * 15);
  score += Math.min(20, highCount * 10);
  score += Math.min(10, mediumCount * 5);
  score += Math.min(15, Math.max(0, reinforcingCount - 1) * 5);
  score -= conflictCount * 15;
  score -= incompleteCount * 10;
  score -= Math.min(15, input.unresolvedLimitations.length * 5);

  const normalizedScore = clampScore(score);
  const overallBand = bandForScore(normalizedScore);

  const supportingFactors: string[] = [];
  const weakeningFactors: string[] = [];

  if (total > 0) {
    supportingFactors.push(`linked investigations: ${String(total)}`);
  }
  if (completedCount > 0) {
    supportingFactors.push(`completed or ready investigations: ${String(completedCount)}`);
  }
  if (highCount > 0) {
    supportingFactors.push(`high-confidence investigations: ${String(highCount)}`);
  }
  if (mediumCount > 0) {
    supportingFactors.push(`medium-confidence investigations: ${String(mediumCount)}`);
  }
  if (reinforcingCount > 1) {
    supportingFactors.push(`reinforcing investigations: ${String(reinforcingCount)}`);
  }

  if (conflictCount > 0) {
    weakeningFactors.push(`material conflicts: ${String(conflictCount)}`);
  }
  if (incompleteCount > 0) {
    weakeningFactors.push(`incomplete investigations: ${String(incompleteCount)}`);
  }
  if (input.unresolvedLimitations.length > 0) {
    weakeningFactors.push(`unresolved propagated limitations: ${String(input.unresolvedLimitations.length)}`);
  }
  if (completedCount === 0 && total > 0) {
    weakeningFactors.push('no completed or ready investigations');
  }
  if (total === 0) {
    weakeningFactors.push('no linked investigations available');
  }

  return {
    overallBand,
    supportingFactors: uniqueSorted(supportingFactors),
    weakeningFactors: uniqueSorted(weakeningFactors),
    unresolvedConflicts: uniqueSorted(input.conflicts.map((entry) => entry.summary))
  };
}
