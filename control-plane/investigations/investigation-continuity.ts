import { computeConfidenceTrend } from './confidence-trend.ts';
import type {
  ConfidenceSnapshot,
  InvestigationContinuitySummary,
  InvestigationDelta,
  InvestigationRevisionRecord,
} from './revision-types.ts';

const materialChangeTypes = new Set([
  'added',
  'removed',
  'confidence_increased',
  'confidence_decreased',
  'counter_evidence_added',
  'gap_resolved',
  'gap_added'
]);

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function evaluateInvestigationContinuity(input: {
  investigationRunId: string;
  revisions: InvestigationRevisionRecord[];
  latestDelta: InvestigationDelta;
  confidenceSnapshots: ConfidenceSnapshot[];
}): InvestigationContinuitySummary {
  const revisionCount = input.revisions.length;
  const confidenceTrend = computeConfidenceTrend(input.confidenceSnapshots);

  const changed = input.latestDelta.deltas.filter((delta) => delta.changeType !== 'unchanged');
  const materiallyChanged = changed.some((delta) => materialChangeTypes.has(delta.changeType));
  const continuityState: InvestigationContinuitySummary['continuityState'] = revisionCount < 2
    ? 'inconclusive'
    : (materiallyChanged ? 'materially_changed' : (changed.length > 0 ? 'evolving' : 'stable'));

  const latestConfidence = input.confidenceSnapshots.length > 0
    ? input.confidenceSnapshots[input.confidenceSnapshots.length - 1]
    : undefined;

  return {
    investigationRunId: input.investigationRunId,
    revisionCount,
    continuityState,
    confidenceTrend,
    majorChanges: uniqueSorted(changed.map((delta) => `${delta.findingId}:${delta.changeType}`)),
    unresolvedLimitations: latestConfidence ? uniqueSorted(latestConfidence.reportLimitations) : []
  };
}
