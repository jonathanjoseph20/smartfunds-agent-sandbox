import type { LinkedInvestigationProjection } from './synthesis-types.ts';
import type { SynthesisConflict } from './synthesis-conflict-classifier.ts';

export interface SynthesisStatus {
  synthesisId: string;
  readinessState:
    | 'pending'
    | 'active'
    | 'ready'
    | 'incomplete'
    | 'inconclusive'
    | 'completed';

  blockingReasons: string[];

  linkedInvestigationCount: number;
  completedInvestigationCount: number;

  unresolvedConflictCount: number;

  strengths: string[];
  limitations: string[];
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isInvestigationComplete(entry: LinkedInvestigationProjection): boolean {
  if (entry.status === 'completed') {
    return true;
  }
  return entry.readinessState === 'complete' || entry.readinessState === 'ready_to_finalize';
}

export function evaluateSynthesisStatus(input: {
  synthesisId: string;
  linkedInvestigations: LinkedInvestigationProjection[];
  conflicts: SynthesisConflict[];
  materialized: boolean;
}): SynthesisStatus {
  const linkedInvestigations = [...input.linkedInvestigations].sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));
  const completedCount = linkedInvestigations.filter(isInvestigationComplete).length;
  const conflictCount = input.conflicts.length;
  const materialConflictCount = input.conflicts.filter((entry) => (
    entry.type === 'direct_finding_conflict'
    || entry.type === 'confidence_mismatch'
  )).length;

  const blockingReasons: string[] = [];
  const strengths: string[] = [];
  const limitations: string[] = [];

  if (linkedInvestigations.length === 0) {
    blockingReasons.push('no_linked_investigations');
  }

  if (completedCount === 0 && linkedInvestigations.length > 0) {
    blockingReasons.push('no_completed_investigations');
  }

  if (completedCount > 0 && completedCount < 2) {
    blockingReasons.push('insufficient_completed_investigations');
  }

  if (materialConflictCount > 0) {
    blockingReasons.push('unresolved_conflicts_present');
  }

  const incompleteIds = linkedInvestigations
    .filter((entry) => !isInvestigationComplete(entry))
    .map((entry) => entry.investigationRunId);
  if (incompleteIds.length > 0) {
    blockingReasons.push('incomplete_component_dependency');
    limitations.push(`incomplete investigations: ${incompleteIds.join(', ')}`);
  }

  const limitationIds = linkedInvestigations
    .filter((entry) => entry.limitations.length > 0 || entry.blockingReasons.length > 0)
    .map((entry) => entry.investigationRunId);
  if (limitationIds.length > 0) {
    limitations.push(`unresolved component limitations: ${limitationIds.join(', ')}`);
  }

  if (linkedInvestigations.length >= 2) {
    strengths.push(`linked investigations: ${String(linkedInvestigations.length)}`);
  }
  if (completedCount >= 2) {
    strengths.push(`completed investigations: ${String(completedCount)}`);
  }

  const sharedFindings = new Map<string, string[]>();
  for (const investigation of linkedInvestigations) {
    for (const finding of investigation.findings) {
      const ids = sharedFindings.get(finding) ?? [];
      sharedFindings.set(finding, uniqueSorted([...ids, investigation.investigationRunId]));
    }
  }

  const reinforced = Array.from(sharedFindings.values()).some((ids) => ids.length >= 2);
  if (reinforced) {
    strengths.push('cross-investigation reinforcement present');
  } else if (linkedInvestigations.length > 1) {
    limitations.push('cross-investigation reinforcement not yet established');
  }

  if (materialConflictCount > 0) {
    limitations.push(`unresolved conflicts: ${String(materialConflictCount)}`);
  }

  let readinessState: SynthesisStatus['readinessState'];
  if (input.materialized) {
    readinessState = 'completed';
  } else if (linkedInvestigations.length === 0) {
    readinessState = 'pending';
  } else if (materialConflictCount > 0) {
    readinessState = 'inconclusive';
  } else if (completedCount === 0) {
    readinessState = 'active';
  } else if (completedCount < 2) {
    readinessState = 'incomplete';
  } else if (incompleteIds.length > 0) {
    readinessState = 'active';
  } else if (!reinforced) {
    readinessState = 'incomplete';
  } else {
    readinessState = 'ready';
  }

  return {
    synthesisId: input.synthesisId,
    readinessState,
    blockingReasons: uniqueSorted(blockingReasons),
    linkedInvestigationCount: linkedInvestigations.length,
    completedInvestigationCount: completedCount,
    unresolvedConflictCount: conflictCount,
    strengths: uniqueSorted(strengths),
    limitations: uniqueSorted(limitations)
  };
}
