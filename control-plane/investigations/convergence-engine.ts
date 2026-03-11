import type { InvestigationConvergenceState } from './completion-types.ts';
import type { ConfidenceSnapshot, InvestigationDelta, InvestigationRevisionRecord } from './revision-types.ts';

function hasDeltaChange(delta: InvestigationDelta | undefined, changeType: InvestigationDelta['deltas'][number]['changeType']): boolean {
  if (!delta) {
    return false;
  }
  return delta.deltas.some((entry) => entry.changeType === changeType);
}

function allUnchanged(delta: InvestigationDelta | undefined): boolean {
  if (!delta) {
    return false;
  }
  return delta.deltas.every((entry) => entry.changeType === 'unchanged');
}

function hasMaterialFindingChange(delta: InvestigationDelta | undefined): boolean {
  if (!delta) {
    return false;
  }
  return delta.deltas.some((entry) => entry.changeType === 'added' || entry.changeType === 'removed');
}

export function evaluateInvestigationConvergence(input: {
  revisions: InvestigationRevisionRecord[];
  confidenceSnapshots: ConfidenceSnapshot[];
  deltas: InvestigationDelta[];
}): InvestigationConvergenceState {
  const revisionCount = input.revisions.length;
  if (revisionCount < 2 || input.confidenceSnapshots.length < 2 || input.deltas.length < 1) {
    return 'inconclusive';
  }

  const latestScore = input.confidenceSnapshots[input.confidenceSnapshots.length - 1]?.reportConfidenceScore;
  const priorScore = input.confidenceSnapshots[input.confidenceSnapshots.length - 2]?.reportConfidenceScore;
  if (latestScore === undefined || priorScore === undefined) {
    return 'inconclusive';
  }

  const latestDelta = input.deltas[input.deltas.length - 1];
  const previousDelta = input.deltas[input.deltas.length - 2];

  const confidenceDecreasing = latestScore < priorScore;
  const counterEvidenceAdded = hasDeltaChange(latestDelta, 'counter_evidence_added');
  if (confidenceDecreasing || counterEvidenceAdded) {
    return 'diverging';
  }

  if (revisionCount >= 3 && input.confidenceSnapshots.length >= 3 && input.deltas.length >= 2) {
    const thirdScore = input.confidenceSnapshots[input.confidenceSnapshots.length - 3]?.reportConfidenceScore;
    const confidenceUnchanged = thirdScore !== undefined && latestScore === priorScore && priorScore === thirdScore;
    const findingsUnchanged = allUnchanged(latestDelta) && allUnchanged(previousDelta);
    if (confidenceUnchanged && findingsUnchanged) {
      return 'stable';
    }
  }

  const noNewCriticalGaps = !hasDeltaChange(latestDelta, 'gap_added');
  const noNewCounterEvidence = !counterEvidenceAdded;
  const confidenceImprovingOrStable = latestScore >= priorScore;
  if (hasMaterialFindingChange(latestDelta)) {
    return 'still_evolving';
  }
  if (confidenceImprovingOrStable && noNewCriticalGaps && noNewCounterEvidence) {
    return 'converging';
  }

  return 'still_evolving';
}
