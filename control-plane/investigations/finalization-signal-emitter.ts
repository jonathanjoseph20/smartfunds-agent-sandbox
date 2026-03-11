import type { InvestigationCompletionStatus } from './completion-types.ts';

export type InvestigationFinalizationSignalType =
  | 'investigation_ready_to_finalize'
  | 'investigation_completed'
  | 'investigation_inconclusive'
  | 'investigation_stalled'
  | 'investigation_confidence_degraded';

export interface InvestigationFinalizationSignal {
  investigationRunId: string;
  signalType: InvestigationFinalizationSignalType;
  fromReadinessState?: InvestigationCompletionStatus['readinessState'];
  toReadinessState: InvestigationCompletionStatus['readinessState'];
  fromHealthState?: InvestigationCompletionStatus['healthState'];
  toHealthState: InvestigationCompletionStatus['healthState'];
}

function signalTypeForStatus(status: InvestigationCompletionStatus): InvestigationFinalizationSignalType | null {
  if (status.readinessState === 'complete') {
    return 'investigation_completed';
  }
  if (status.readinessState === 'ready_to_finalize') {
    return 'investigation_ready_to_finalize';
  }
  if (status.readinessState === 'inconclusive') {
    return 'investigation_inconclusive';
  }
  if (status.healthState === 'stalled') {
    return 'investigation_stalled';
  }
  if (status.healthState === 'degraded_by_counter_evidence') {
    return 'investigation_confidence_degraded';
  }
  return null;
}

export function finalizationSignalFingerprint(input: {
  investigationRunId: string;
  signalType: InvestigationFinalizationSignalType;
  status: InvestigationCompletionStatus;
}): string {
  return [
    input.investigationRunId,
    input.signalType,
    input.status.readinessState,
    input.status.convergenceState,
    input.status.healthState
  ].join(':');
}

export function emitFinalizationSignalOnTransition(input: {
  investigationRunId: string;
  currentStatus: InvestigationCompletionStatus;
  previousStatus?: InvestigationCompletionStatus;
  seenFingerprints?: ReadonlySet<string>;
}): InvestigationFinalizationSignal | null {
  const currentSignalType = signalTypeForStatus(input.currentStatus);
  if (!currentSignalType) {
    return null;
  }

  const previousSignalType = input.previousStatus ? signalTypeForStatus(input.previousStatus) : null;
  if (
    previousSignalType === currentSignalType
    && input.previousStatus?.readinessState === input.currentStatus.readinessState
    && input.previousStatus?.healthState === input.currentStatus.healthState
    && input.previousStatus?.convergenceState === input.currentStatus.convergenceState
  ) {
    return null;
  }

  const fingerprint = finalizationSignalFingerprint({
    investigationRunId: input.investigationRunId,
    signalType: currentSignalType,
    status: input.currentStatus
  });
  if (input.seenFingerprints?.has(fingerprint)) {
    return null;
  }

  return {
    investigationRunId: input.investigationRunId,
    signalType: currentSignalType,
    ...(input.previousStatus ? { fromReadinessState: input.previousStatus.readinessState } : {}),
    toReadinessState: input.currentStatus.readinessState,
    ...(input.previousStatus ? { fromHealthState: input.previousStatus.healthState } : {}),
    toHealthState: input.currentStatus.healthState
  };
}

