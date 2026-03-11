import type {
  CompletionConfidenceMetrics,
  CompletionEvidenceMetrics,
  CompletionLifecycleSnapshot,
  InvestigationHealthState,
} from './completion-types.ts';
import type { InvestigationDelta, InvestigationRevisionRecord } from './revision-types.ts';
import type { InvestigationEventRecord } from './investigation-types.ts';

function hasDeltaChange(delta: InvestigationDelta | undefined, changeType: InvestigationDelta['deltas'][number]['changeType']): boolean {
  if (!delta) {
    return false;
  }
  return delta.deltas.some((entry) => entry.changeType === changeType);
}

function allUnchanged(deltas: InvestigationDelta[]): boolean {
  return deltas.length > 0 && deltas.every((delta) => delta.deltas.every((entry) => entry.changeType === 'unchanged'));
}

export function classifyInvestigationHealth(input: {
  lifecycle: CompletionLifecycleSnapshot;
  confidence: CompletionConfidenceMetrics;
  evidence: CompletionEvidenceMetrics;
  revisions: InvestigationRevisionRecord[];
  deltas: InvestigationDelta[];
  history?: InvestigationEventRecord[];
}): InvestigationHealthState {
  if (input.evidence.supportingEvidenceCount > 0 && input.evidence.counterEvidenceCount > 0 && input.confidence.trend === 'mixed') {
    return 'inconclusive';
  }

  if (input.evidence.unresolvedCriticalGapCount > 0) {
    return 'blocked_by_missing_evidence';
  }

  const latestDelta = input.deltas[input.deltas.length - 1];
  const degradedByCounterEvidence = input.evidence.counterEvidenceCount > 0
    && (
      input.confidence.trend === 'degrading'
      || hasDeltaChange(latestDelta, 'counter_evidence_added')
      || hasDeltaChange(latestDelta, 'confidence_decreased')
    );
  if (degradedByCounterEvidence) {
    return 'degraded_by_counter_evidence';
  }

  if (
    input.lifecycle.status === 'awaiting_data'
    && (
      input.lifecycle.waitingReason?.includes('dataset') === true
      || input.lifecycle.waitingReason?.includes('awaiting_new_dataset_observation') === true
    )
  ) {
    return 'waiting_normally';
  }

  if (
    input.lifecycle.status === 'retry_pending'
    || (input.history ?? []).some((event) => event.eventType === 'PHASE_RETRY_SCHEDULED')
  ) {
    return 'retrying';
  }

  const recentDeltas = input.deltas.slice(-2);
  const stalled = input.revisions.length >= 3
    && recentDeltas.length === 2
    && allUnchanged(recentDeltas)
    && input.confidence.trend === 'flat'
    && ['running', 'scheduled_resume', 'awaiting_data'].includes(input.lifecycle.status);
  if (stalled) {
    return 'stalled';
  }

  if (
    (input.lifecycle.status === 'running' || input.lifecycle.status === 'scheduled_resume')
    && input.evidence.supportingEvidenceCount > 0
    && input.evidence.unresolvedCriticalGapCount === 0
  ) {
    return 'healthy';
  }

  return 'inconclusive';
}
