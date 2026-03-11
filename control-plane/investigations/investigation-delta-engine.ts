import type {
  ConfidenceBand,
  FindingDelta,
  FindingSnapshot,
  InvestigationDelta,
} from './revision-types.ts';

const bandRank: Record<ConfidenceBand, number> = {
  low: 0,
  medium: 1,
  high: 2
};

function sortDeltas(deltas: FindingDelta[]): FindingDelta[] {
  return [...deltas].sort((left, right) => left.findingId.localeCompare(right.findingId));
}

function changeForExistingFinding(input: {
  prior: FindingSnapshot;
  next: FindingSnapshot;
}): FindingDelta {
  const priorBandRank = bandRank[input.prior.confidenceBand];
  const nextBandRank = bandRank[input.next.confidenceBand];

  if (nextBandRank > priorBandRank) {
    return {
      findingId: input.next.findingId,
      changeType: 'confidence_increased',
      priorConfidenceBand: input.prior.confidenceBand,
      nextConfidenceBand: input.next.confidenceBand,
      reason: `confidence band increased from ${input.prior.confidenceBand} to ${input.next.confidenceBand}`
    };
  }

  if (nextBandRank < priorBandRank) {
    return {
      findingId: input.next.findingId,
      changeType: 'confidence_decreased',
      priorConfidenceBand: input.prior.confidenceBand,
      nextConfidenceBand: input.next.confidenceBand,
      reason: `confidence band decreased from ${input.prior.confidenceBand} to ${input.next.confidenceBand}`
    };
  }

  if (input.next.supportCount > input.prior.supportCount) {
    return {
      findingId: input.next.findingId,
      changeType: 'support_strengthened',
      priorConfidenceBand: input.prior.confidenceBand,
      nextConfidenceBand: input.next.confidenceBand,
      reason: `supporting evidence count increased from ${String(input.prior.supportCount)} to ${String(input.next.supportCount)}`
    };
  }

  if (input.next.counterEvidenceCount > input.prior.counterEvidenceCount) {
    return {
      findingId: input.next.findingId,
      changeType: 'counter_evidence_added',
      priorConfidenceBand: input.prior.confidenceBand,
      nextConfidenceBand: input.next.confidenceBand,
      reason: `counter evidence count increased from ${String(input.prior.counterEvidenceCount)} to ${String(input.next.counterEvidenceCount)}`
    };
  }

  if (input.next.unresolvedGapCount > input.prior.unresolvedGapCount) {
    return {
      findingId: input.next.findingId,
      changeType: 'gap_added',
      priorConfidenceBand: input.prior.confidenceBand,
      nextConfidenceBand: input.next.confidenceBand,
      reason: `unresolved gap count increased from ${String(input.prior.unresolvedGapCount)} to ${String(input.next.unresolvedGapCount)}`
    };
  }

  if (input.next.unresolvedGapCount < input.prior.unresolvedGapCount) {
    return {
      findingId: input.next.findingId,
      changeType: 'gap_resolved',
      priorConfidenceBand: input.prior.confidenceBand,
      nextConfidenceBand: input.next.confidenceBand,
      reason: `unresolved gap count decreased from ${String(input.prior.unresolvedGapCount)} to ${String(input.next.unresolvedGapCount)}`
    };
  }

  return {
    findingId: input.next.findingId,
    changeType: 'unchanged',
    priorConfidenceBand: input.prior.confidenceBand,
    nextConfidenceBand: input.next.confidenceBand,
    reason: 'no structured change detected'
  };
}

export function computeInvestigationDelta(input: {
  investigationRunId: string;
  revisionId: string;
  previousRevisionId?: string;
  priorFindings?: FindingSnapshot[];
  nextFindings: FindingSnapshot[];
}): InvestigationDelta {
  const priorByFinding = new Map((input.priorFindings ?? []).map((entry) => [entry.findingId, entry]));
  const nextByFinding = new Map(input.nextFindings.map((entry) => [entry.findingId, entry]));
  const allFindingIds = Array.from(new Set([
    ...Array.from(priorByFinding.keys()),
    ...Array.from(nextByFinding.keys())
  ])).sort((left, right) => left.localeCompare(right));

  const deltas = allFindingIds.map((findingId) => {
    const prior = priorByFinding.get(findingId);
    const next = nextByFinding.get(findingId);

    if (!prior && next) {
      return {
        findingId,
        changeType: 'added',
        nextConfidenceBand: next.confidenceBand,
        reason: 'finding introduced in current revision'
      } as FindingDelta;
    }

    if (prior && !next) {
      return {
        findingId,
        changeType: 'removed',
        priorConfidenceBand: prior.confidenceBand,
        reason: 'finding removed in current revision'
      } as FindingDelta;
    }

    return changeForExistingFinding({
      prior: prior as FindingSnapshot,
      next: next as FindingSnapshot
    });
  });

  return {
    investigationRunId: input.investigationRunId,
    revisionId: input.revisionId,
    ...(input.previousRevisionId ? { previousRevisionId: input.previousRevisionId } : {}),
    deltas: sortDeltas(deltas)
  };
}
