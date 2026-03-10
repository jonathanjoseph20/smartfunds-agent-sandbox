import type { ConfidenceSummary, EvidenceRecord } from './evidence-types.ts';

function clampScore(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

function bandForScore(score: number): ConfidenceSummary['confidenceBand'] {
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

export function computeConfidence(input: {
  supportingEvidence: EvidenceRecord[];
  counterEvidence: EvidenceRecord[];
  unresolvedGaps: EvidenceRecord[];
}): ConfidenceSummary {
  const supportingCount = input.supportingEvidence.length;
  const counterCount = input.counterEvidence.length;
  const gapCount = input.unresolvedGaps.length;
  const supportingTypeDiversity = new Set(input.supportingEvidence.map((record) => record.evidenceType)).size;
  const hasCrossCycle = input.supportingEvidence.some((record) => record.evidenceType === 'cross_cycle_confirmation');

  let score = 40;
  score += Math.min(30, supportingCount * 10);
  score += Math.min(15, supportingTypeDiversity * 5);
  if (hasCrossCycle) {
    score += 10;
  }
  score -= counterCount * 15;
  score -= gapCount * 10;

  const normalizedScore = clampScore(score);
  const confidenceBand = bandForScore(normalizedScore);

  const strengths: string[] = [];
  const limitations: string[] = [];

  if (supportingCount > 0) {
    strengths.push(`supporting evidence records: ${String(supportingCount)}`);
  }
  if (supportingTypeDiversity >= 2) {
    strengths.push(`supporting evidence type diversity: ${String(supportingTypeDiversity)}`);
  }
  if (hasCrossCycle) {
    strengths.push('cross-cycle confirmation present');
  }

  if (counterCount > 0) {
    limitations.push(`counter-evidence records: ${String(counterCount)}`);
  }
  if (gapCount > 0) {
    limitations.push(`unresolved gaps: ${String(gapCount)}`);
  }
  if (supportingCount === 0) {
    limitations.push('no supporting evidence records');
  }

  return {
    confidenceBand,
    confidenceScore: normalizedScore,
    confidenceReason: `score=${String(normalizedScore)} band=${confidenceBand}`,
    strengths: uniqueSorted(strengths),
    limitations: uniqueSorted(limitations)
  };
}
