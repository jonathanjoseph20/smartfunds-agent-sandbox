import { evaluateInvestigationCompletion } from './completion-evaluator.ts';
import type {
  CompletionConfidenceMetrics,
  CompletionEvidenceMetrics,
  CompletionLifecycleSnapshot,
  InvestigationCompletionCriteria,
  InvestigationCompletionStatus,
} from './completion-types.ts';
import { evaluateInvestigationConvergence } from './convergence-engine.ts';
import { classifyInvestigationHealth } from './health-classifier.ts';
import { computeConfidenceTrend } from './confidence-trend.ts';
import type { InvestigationEventRecord } from './investigation-types.ts';
import type { ConfidenceSnapshot, InvestigationDelta, InvestigationRevisionRecord } from './revision-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function latestConfidenceMetrics(confidenceSnapshots: ConfidenceSnapshot[]): CompletionConfidenceMetrics {
  if (confidenceSnapshots.length === 0) {
    return {
      reportConfidenceBand: 'low',
      reportConfidenceScore: 0,
      trend: 'flat'
    };
  }

  const latest = confidenceSnapshots[confidenceSnapshots.length - 1];
  return {
    reportConfidenceBand: latest.reportConfidenceBand,
    reportConfidenceScore: latest.reportConfidenceScore,
    trend: computeConfidenceTrend(confidenceSnapshots)
  };
}

export function buildInvestigationCompletionStatus(input: {
  investigationRunId: string;
  lifecycle: CompletionLifecycleSnapshot;
  criteria?: InvestigationCompletionCriteria;
  revisions: InvestigationRevisionRecord[];
  deltas: InvestigationDelta[];
  confidenceSnapshots: ConfidenceSnapshot[];
  evidence: CompletionEvidenceMetrics;
  history?: InvestigationEventRecord[];
}): InvestigationCompletionStatus {
  const confidence = latestConfidenceMetrics(input.confidenceSnapshots);
  const convergenceState = evaluateInvestigationConvergence({
    revisions: input.revisions,
    confidenceSnapshots: input.confidenceSnapshots,
    deltas: input.deltas
  });
  const healthState = classifyInvestigationHealth({
    lifecycle: input.lifecycle,
    confidence,
    evidence: input.evidence,
    revisions: input.revisions,
    deltas: input.deltas,
    history: input.history
  });
  const completion = evaluateInvestigationCompletion({
    convergenceState,
    healthState,
    lifecycle: input.lifecycle,
    confidence,
    evidence: input.evidence,
    criteria: input.criteria,
    latestDelta: input.deltas[input.deltas.length - 1]
  });

  const latestConfidence = input.confidenceSnapshots[input.confidenceSnapshots.length - 1];

  return {
    investigationRunId: input.investigationRunId,
    readinessState: completion.readinessState,
    convergenceState,
    healthState,
    blockingReasons: uniqueSorted(completion.blockingReasons),
    strengths: uniqueSorted(latestConfidence?.reportStrengths ?? []),
    limitations: uniqueSorted(latestConfidence?.reportLimitations ?? [])
  };
}

export function evidenceMetricsFromCounts(input: {
  supportingEvidenceCount: number;
  counterEvidenceCount: number;
  unresolvedGapCount: number;
}): CompletionEvidenceMetrics {
  return {
    supportingEvidenceCount: input.supportingEvidenceCount,
    counterEvidenceCount: input.counterEvidenceCount,
    unresolvedGapCount: input.unresolvedGapCount,
    unresolvedCriticalGapCount: input.unresolvedGapCount
  };
}

