import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { LinkedInvestigationProjection } from './synthesis-types.ts';

export interface SynthesisConflict {
  conflictId: string;
  type:
    | 'direct_finding_conflict'
    | 'confidence_mismatch'
    | 'support_imbalance'
    | 'unresolved_component_limitations'
    | 'incomplete_component_dependency';
  investigationIds: string[];
  findingIds?: string[];
  summary: string;
}

type FindingPresence = {
  findingId: string;
  investigationIds: string[];
  confidenceBands: Array<{ investigationId: string; band: 'low' | 'medium' | 'high' }>;
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function bandRank(band: 'low' | 'medium' | 'high'): number {
  if (band === 'low') return 0;
  if (band === 'medium') return 1;
  return 2;
}

function parseFinding(findingId: string): { key: string; value: string } {
  const segments = findingId.split(':');
  const key = `${segments[0] ?? findingId}:${segments[1] ?? 'unknown'}`;
  const value = segments.length > 2 ? segments.slice(2).join(':') : (segments[1] ?? 'unknown');
  return { key, value };
}

function deterministicConflictId(input: Omit<SynthesisConflict, 'conflictId'> & { synthesisId: string }): string {
  return sha256(canonicalStringify({
    synthesisId: input.synthesisId,
    type: input.type,
    investigationIds: input.investigationIds,
    findingIds: input.findingIds ?? [],
    summary: input.summary
  }));
}

function isInvestigationComplete(entry: LinkedInvestigationProjection): boolean {
  if (entry.status === 'completed') {
    return true;
  }
  return entry.readinessState === 'complete' || entry.readinessState === 'ready_to_finalize';
}

export function classifySynthesisConflicts(input: {
  synthesisId: string;
  linkedInvestigations: LinkedInvestigationProjection[];
}): SynthesisConflict[] {
  const linked = [...input.linkedInvestigations].sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));
  const conflicts: SynthesisConflict[] = [];

  const incompleteIds = linked
    .filter((entry) => !isInvestigationComplete(entry))
    .map((entry) => entry.investigationRunId);

  if (incompleteIds.length > 0) {
    const summary = `incomplete linked investigations: ${incompleteIds.join(', ')}`;
    const base: Omit<SynthesisConflict, 'conflictId'> & { synthesisId: string } = {
      synthesisId: input.synthesisId,
      type: 'incomplete_component_dependency',
      investigationIds: incompleteIds,
      summary
    };
    conflicts.push({
      conflictId: deterministicConflictId(base),
      type: base.type,
      investigationIds: base.investigationIds,
      summary: base.summary
    });
  }

  const limitationIds = linked
    .filter((entry) => entry.limitations.length > 0 || entry.blockingReasons.length > 0)
    .map((entry) => entry.investigationRunId);

  if (limitationIds.length > 0) {
    const summary = `unresolved component limitations in investigations: ${limitationIds.join(', ')}`;
    const base: Omit<SynthesisConflict, 'conflictId'> & { synthesisId: string } = {
      synthesisId: input.synthesisId,
      type: 'unresolved_component_limitations',
      investigationIds: limitationIds,
      summary
    };
    conflicts.push({
      conflictId: deterministicConflictId(base),
      type: base.type,
      investigationIds: base.investigationIds,
      summary: base.summary
    });
  }

  const findingPresence = new Map<string, FindingPresence>();
  for (const investigation of linked) {
    for (const findingId of investigation.findings) {
      const existing = findingPresence.get(findingId) ?? {
        findingId,
        investigationIds: [],
        confidenceBands: []
      };
      existing.investigationIds = uniqueSorted([...existing.investigationIds, investigation.investigationRunId]);
      existing.confidenceBands = [...existing.confidenceBands, {
        investigationId: investigation.investigationRunId,
        band: investigation.reportConfidenceBand
      }].sort((left, right) => left.investigationId.localeCompare(right.investigationId));
      findingPresence.set(findingId, existing);
    }
  }

  const findingsByKey = new Map<string, Array<{ findingId: string; value: string; investigationIds: string[] }>>();
  for (const finding of findingPresence.values()) {
    const parsed = parseFinding(finding.findingId);
    const current = findingsByKey.get(parsed.key) ?? [];
    current.push({ findingId: finding.findingId, value: parsed.value, investigationIds: finding.investigationIds });
    findingsByKey.set(parsed.key, current.sort((left, right) => left.findingId.localeCompare(right.findingId)));
  }

  for (const [key, values] of [...findingsByKey.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    const distinctValues = uniqueSorted(values.map((entry) => entry.value));
    if (distinctValues.length <= 1) {
      continue;
    }

    const investigationIds = uniqueSorted(values.flatMap((entry) => entry.investigationIds));
    const findingIds = uniqueSorted(values.map((entry) => entry.findingId));
    const summary = `direct finding conflict for ${key}: ${distinctValues.join(' vs ')}`;
    const base: Omit<SynthesisConflict, 'conflictId'> & { synthesisId: string } = {
      synthesisId: input.synthesisId,
      type: 'direct_finding_conflict',
      investigationIds,
      findingIds,
      summary
    };

    conflicts.push({
      conflictId: deterministicConflictId(base),
      type: base.type,
      investigationIds: base.investigationIds,
      findingIds: base.findingIds,
      summary: base.summary
    });
  }

  for (const finding of [...findingPresence.values()].sort((left, right) => left.findingId.localeCompare(right.findingId))) {
    if (finding.investigationIds.length < 2) {
      continue;
    }

    const ranks = finding.confidenceBands.map((entry) => bandRank(entry.band));
    const maxRank = Math.max(...ranks);
    const minRank = Math.min(...ranks);
    if (maxRank - minRank < 2) {
      continue;
    }

    const summary = `confidence mismatch for finding ${finding.findingId}`;
    const base: Omit<SynthesisConflict, 'conflictId'> & { synthesisId: string } = {
      synthesisId: input.synthesisId,
      type: 'confidence_mismatch',
      investigationIds: finding.investigationIds,
      findingIds: [finding.findingId],
      summary
    };

    conflicts.push({
      conflictId: deterministicConflictId(base),
      type: base.type,
      investigationIds: base.investigationIds,
      findingIds: base.findingIds,
      summary: base.summary
    });
  }

  if (linked.length >= 3) {
    for (const finding of [...findingPresence.values()].sort((left, right) => left.findingId.localeCompare(right.findingId))) {
      if (finding.investigationIds.length >= 2) {
        continue;
      }

      const summary = `support imbalance for finding ${finding.findingId}: only ${String(finding.investigationIds.length)} supporting investigation`;
      const base: Omit<SynthesisConflict, 'conflictId'> & { synthesisId: string } = {
        synthesisId: input.synthesisId,
        type: 'support_imbalance',
        investigationIds: finding.investigationIds,
        findingIds: [finding.findingId],
        summary
      };

      conflicts.push({
        conflictId: deterministicConflictId(base),
        type: base.type,
        investigationIds: base.investigationIds,
        findingIds: base.findingIds,
        summary: base.summary
      });
    }
  }

  const typeRank: Record<SynthesisConflict['type'], number> = {
    direct_finding_conflict: 0,
    confidence_mismatch: 1,
    support_imbalance: 2,
    unresolved_component_limitations: 3,
    incomplete_component_dependency: 4
  };

  return [...conflicts].sort((left, right) => {
    const typeCmp = typeRank[left.type] - typeRank[right.type];
    if (typeCmp !== 0) {
      return typeCmp;
    }
    return left.conflictId.localeCompare(right.conflictId);
  });
}
