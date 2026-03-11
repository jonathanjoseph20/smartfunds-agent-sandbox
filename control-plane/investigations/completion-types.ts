import type { ConfidenceBand, InvestigationContinuitySummary } from './revision-types.ts';
import type { InvestigationStatus } from './investigation-types.ts';

export type InvestigationReadinessState =
  | 'ready_to_finalize'
  | 'still_evolving'
  | 'blocked'
  | 'inconclusive'
  | 'complete'
  | 'unhealthy';

export type InvestigationConvergenceState =
  | 'converging'
  | 'stable'
  | 'still_evolving'
  | 'diverging'
  | 'inconclusive';

export type InvestigationHealthState =
  | 'healthy'
  | 'waiting_normally'
  | 'retrying'
  | 'blocked_by_missing_evidence'
  | 'degraded_by_counter_evidence'
  | 'stalled'
  | 'inconclusive';

export interface InvestigationCompletionStatus {
  investigationRunId: string;
  readinessState: InvestigationReadinessState;
  convergenceState: InvestigationConvergenceState;
  healthState: InvestigationHealthState;
  blockingReasons: string[];
  strengths: string[];
  limitations: string[];
}

export interface InvestigationCompletionCriteria {
  requiredPhaseIds?: string[];
  minimumConfidenceBand?: Extract<ConfidenceBand, 'medium' | 'high'>;
  requireNoCriticalGaps?: boolean;
  requireConvergenceState?: Extract<InvestigationConvergenceState, 'converging' | 'stable'>;
  minimumSupportingEvidenceCount?: number;
}

export type CompletionEvidenceMetrics = {
  supportingEvidenceCount: number;
  counterEvidenceCount: number;
  unresolvedCriticalGapCount: number;
  unresolvedGapCount: number;
};

export type CompletionConfidenceMetrics = {
  reportConfidenceBand: ConfidenceBand;
  reportConfidenceScore: number;
  trend: InvestigationContinuitySummary['confidenceTrend'];
};

export type CompletionLifecycleSnapshot = {
  status: InvestigationStatus;
  completedPhaseIds: string[];
  waitingReason?: string;
};

export function normalizeCompletionCriteria(
  criteria?: InvestigationCompletionCriteria
): Required<InvestigationCompletionCriteria> {
  const minimumSupportingEvidenceCount = criteria?.minimumSupportingEvidenceCount;
  return {
    requiredPhaseIds: [...(criteria?.requiredPhaseIds ?? [])].sort((left, right) => left.localeCompare(right)),
    minimumConfidenceBand: criteria?.minimumConfidenceBand ?? 'medium',
    requireNoCriticalGaps: criteria?.requireNoCriticalGaps ?? false,
    requireConvergenceState: criteria?.requireConvergenceState ?? 'converging',
    minimumSupportingEvidenceCount: Number.isInteger(minimumSupportingEvidenceCount) && minimumSupportingEvidenceCount > 0
      ? Number(minimumSupportingEvidenceCount)
      : 0
  };
}

