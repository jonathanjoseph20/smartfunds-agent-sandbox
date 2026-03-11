import {
  normalizeCompletionCriteria,
  type CompletionConfidenceMetrics,
  type CompletionEvidenceMetrics,
  type CompletionLifecycleSnapshot,
  type InvestigationCompletionCriteria,
  type InvestigationConvergenceState,
  type InvestigationHealthState,
  type InvestigationReadinessState,
} from './completion-types.ts';
import type { InvestigationDelta } from './revision-types.ts';

const BAND_RANK: Record<CompletionConfidenceMetrics['reportConfidenceBand'], number> = {
  low: 0,
  medium: 1,
  high: 2
};

function confidenceMeetsThreshold(input: {
  reportBand: CompletionConfidenceMetrics['reportConfidenceBand'];
  threshold: NonNullable<InvestigationCompletionCriteria['minimumConfidenceBand']>;
}): boolean {
  return BAND_RANK[input.reportBand] >= BAND_RANK[input.threshold];
}

function requiredConvergenceSatisfied(input: {
  required: NonNullable<InvestigationCompletionCriteria['requireConvergenceState']>;
  actual: InvestigationConvergenceState;
}): boolean {
  if (input.required === 'stable') {
    return input.actual === 'stable';
  }
  return input.actual === 'converging' || input.actual === 'stable';
}

function hasRecentCounterEvidence(delta?: InvestigationDelta): boolean {
  return (delta?.deltas ?? []).some((entry) => entry.changeType === 'counter_evidence_added');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function evaluateInvestigationCompletion(input: {
  convergenceState: InvestigationConvergenceState;
  healthState: InvestigationHealthState;
  lifecycle: CompletionLifecycleSnapshot;
  confidence: CompletionConfidenceMetrics;
  evidence: CompletionEvidenceMetrics;
  criteria?: InvestigationCompletionCriteria;
  latestDelta?: InvestigationDelta;
}): {
  readinessState: InvestigationReadinessState;
  blockingReasons: string[];
} {
  const criteria = normalizeCompletionCriteria(input.criteria);
  const blockingReasons: string[] = [];

  if (criteria.requiredPhaseIds.some((phaseId) => !input.lifecycle.completedPhaseIds.includes(phaseId))) {
    blockingReasons.push('required_phase_incomplete');
  }

  if (!confidenceMeetsThreshold({ reportBand: input.confidence.reportConfidenceBand, threshold: criteria.minimumConfidenceBand })) {
    blockingReasons.push('confidence_below_threshold');
  }

  if (criteria.requireNoCriticalGaps && input.evidence.unresolvedCriticalGapCount > 0) {
    blockingReasons.push('critical_gap_unresolved');
  }

  if (
    criteria.minimumSupportingEvidenceCount > 0
    && input.evidence.supportingEvidenceCount < criteria.minimumSupportingEvidenceCount
  ) {
    blockingReasons.push('awaiting_additional_cycle_confirmation');
  }

  if (!requiredConvergenceSatisfied({ required: criteria.requireConvergenceState, actual: input.convergenceState })) {
    blockingReasons.push('awaiting_additional_cycle_confirmation');
  }

  if (input.healthState === 'waiting_normally') {
    blockingReasons.push('awaiting_dataset_update');
  }

  if (hasRecentCounterEvidence(input.latestDelta)) {
    blockingReasons.push('recent_counter_evidence_added');
  }

  const uniqueReasons = uniqueSorted(blockingReasons);

  if (input.healthState === 'stalled' || input.healthState === 'degraded_by_counter_evidence') {
    return {
      readinessState: 'unhealthy',
      blockingReasons: uniqueReasons
    };
  }

  if (input.lifecycle.status === 'completed' && uniqueReasons.length === 0) {
    return {
      readinessState: 'complete',
      blockingReasons: uniqueReasons
    };
  }

  if (input.healthState === 'blocked_by_missing_evidence' || uniqueReasons.includes('required_phase_incomplete') || uniqueReasons.includes('critical_gap_unresolved')) {
    return {
      readinessState: 'blocked',
      blockingReasons: uniqueReasons
    };
  }

  if (input.convergenceState === 'still_evolving') {
    return {
      readinessState: 'still_evolving',
      blockingReasons: uniqueReasons
    };
  }

  if (input.convergenceState === 'inconclusive' || input.healthState === 'inconclusive') {
    return {
      readinessState: 'inconclusive',
      blockingReasons: uniqueReasons
    };
  }

  if (
    uniqueReasons.length === 0
    && (input.convergenceState === 'converging' || input.convergenceState === 'stable')
  ) {
    return {
      readinessState: 'ready_to_finalize',
      blockingReasons: uniqueReasons
    };
  }

  return {
    readinessState: 'still_evolving',
    blockingReasons: uniqueReasons
  };
}

