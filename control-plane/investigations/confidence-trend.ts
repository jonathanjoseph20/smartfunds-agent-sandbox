import type { ConfidenceSnapshot, InvestigationContinuitySummary } from './revision-types.ts';

export function computeConfidenceTrend(
  snapshots: ConfidenceSnapshot[]
): InvestigationContinuitySummary['confidenceTrend'] {
  if (snapshots.length <= 1) {
    return 'flat';
  }

  let sawIncrease = false;
  let sawDecrease = false;

  for (let index = 1; index < snapshots.length; index += 1) {
    const prior = snapshots[index - 1];
    const next = snapshots[index];

    if (next.reportConfidenceScore > prior.reportConfidenceScore) {
      sawIncrease = true;
      continue;
    }
    if (next.reportConfidenceScore < prior.reportConfidenceScore) {
      sawDecrease = true;
    }
  }

  if (sawIncrease && sawDecrease) {
    return 'mixed';
  }
  if (sawIncrease) {
    return 'improving';
  }
  if (sawDecrease) {
    return 'degrading';
  }
  return 'flat';
}
