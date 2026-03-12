import type {
  MissionRuntimeEnvelopeHistoryEntry,
  RuntimeEnvelopeEligibility,
  RuntimeEnvelopeState,
} from './runtime-envelope-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasHistoryEvent(entries: MissionRuntimeEnvelopeHistoryEntry[] | undefined, eventType: string): boolean {
  if (!entries) {
    return false;
  }
  return entries.some((entry) => entry.eventType === eventType);
}

function deriveEligibilityFromExecution(input: {
  executionEligibilityState: string;
  contractState: string;
}): RuntimeEnvelopeEligibility {
  if (input.contractState === 'rejected' || input.executionEligibilityState === 'blocked') {
    return 'blocked';
  }

  if (input.executionEligibilityState === 'eligible') {
    return 'eligible';
  }
  if (input.executionEligibilityState === 'waiting_on_runtime_preparation') {
    return 'waiting_on_runtime_support';
  }
  if (input.executionEligibilityState === 'incomplete') {
    return 'incomplete';
  }

  return 'inconclusive';
}

export function deriveRuntimeEnvelopeStatus(input: {
  executionEligibilityState: string;
  contractState: string;
  contractBlockers: string[];
  contractLimitations: string[];
  historyEntries?: MissionRuntimeEnvelopeHistoryEntry[];
}): {
  envelopeState: RuntimeEnvelopeState;
  envelopeEligibility: RuntimeEnvelopeEligibility;
  blockers: string[];
  limitations: string[];
} {
  const blockers = uniqueSorted(input.contractBlockers);
  const limitations = uniqueSorted([
    ...input.contractLimitations,
    'runtime_envelope_pre_execution_only',
    'runtime_envelope_projection_only',
  ]);

  if (hasHistoryEvent(input.historyEntries, 'runtime_envelope_rejected')) {
    return {
      envelopeState: 'rejected',
      envelopeEligibility: 'blocked',
      blockers: uniqueSorted([...blockers, 'runtime_envelope_rejected']),
      limitations,
    };
  }

  const envelopeEligibility = deriveEligibilityFromExecution({
    executionEligibilityState: input.executionEligibilityState,
    contractState: input.contractState,
  });

  if (envelopeEligibility === 'blocked' || blockers.length > 0) {
    return {
      envelopeState: 'blocked',
      envelopeEligibility: 'blocked',
      blockers,
      limitations,
    };
  }

  if (hasHistoryEvent(input.historyEntries, 'runtime_envelope_confirmed')) {
    return {
      envelopeState: 'ready_for_runtime',
      envelopeEligibility,
      blockers,
      limitations,
    };
  }

  if (envelopeEligibility === 'waiting_on_runtime_support') {
    return {
      envelopeState: 'under_review',
      envelopeEligibility,
      blockers,
      limitations,
    };
  }

  if (envelopeEligibility === 'eligible') {
    return {
      envelopeState: 'evaluated',
      envelopeEligibility,
      blockers,
      limitations,
    };
  }

  return {
    envelopeState: 'evaluated',
    envelopeEligibility,
    blockers,
    limitations,
  };
}
