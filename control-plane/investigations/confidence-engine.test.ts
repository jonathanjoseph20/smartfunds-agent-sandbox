import { describe, expect, it } from 'vitest';

import { computeConfidence } from './confidence-engine.ts';
import type { EvidenceRecord } from './evidence-types.ts';

function evidence(evidenceType: EvidenceRecord['evidenceType'], evidenceId: string): EvidenceRecord {
  return {
    evidenceId,
    investigationRunId: 'run-1',
    phaseId: 'gather',
    evidenceType,
    summary: evidenceId,
    payload: {},
    findingIds: ['finding-1']
  };
}

describe('confidence engine', () => {
  it('T-INV-CF1 increases confidence with supporting evidence and diversity', () => {
    const result = computeConfidence({
      supportingEvidence: [evidence('raw_observation', 's1'), evidence('derived_metric', 's2')],
      counterEvidence: [],
      unresolvedGaps: []
    });

    expect(result.confidenceScore).toBeGreaterThan(40);
    expect(result.confidenceBand).toBe('high');
  });

  it('T-INV-CF2 reduces confidence with counter-evidence', () => {
    const baseline = computeConfidence({
      supportingEvidence: [evidence('raw_observation', 's1'), evidence('derived_metric', 's2')],
      counterEvidence: [],
      unresolvedGaps: []
    });
    const reduced = computeConfidence({
      supportingEvidence: [evidence('raw_observation', 's1'), evidence('derived_metric', 's2')],
      counterEvidence: [evidence('counter_evidence', 'c1')],
      unresolvedGaps: []
    });

    expect(reduced.confidenceScore).toBeLessThan(baseline.confidenceScore);
  });

  it('T-INV-CF3 reduces confidence with unresolved gaps', () => {
    const baseline = computeConfidence({
      supportingEvidence: [evidence('raw_observation', 's1')],
      counterEvidence: [],
      unresolvedGaps: []
    });
    const reduced = computeConfidence({
      supportingEvidence: [evidence('raw_observation', 's1')],
      counterEvidence: [],
      unresolvedGaps: [evidence('unresolved_gap', 'g1')]
    });

    expect(reduced.confidenceScore).toBeLessThan(baseline.confidenceScore);
  });

  it('T-INV-CF4 boosts confidence with cross-cycle confirmation', () => {
    const baseline = computeConfidence({
      supportingEvidence: [evidence('raw_observation', 's1')],
      counterEvidence: [],
      unresolvedGaps: []
    });
    const boosted = computeConfidence({
      supportingEvidence: [evidence('raw_observation', 's1'), evidence('cross_cycle_confirmation', 'x1')],
      counterEvidence: [],
      unresolvedGaps: []
    });

    expect(boosted.confidenceScore).toBeGreaterThan(baseline.confidenceScore);
  });

  it('T-INV-CF5 is deterministic for identical inputs', () => {
    const input = {
      supportingEvidence: [evidence('raw_observation', 's1'), evidence('cross_cycle_confirmation', 'x1')],
      counterEvidence: [evidence('counter_evidence', 'c1')],
      unresolvedGaps: [evidence('unresolved_gap', 'g1')]
    };
    const first = computeConfidence(input);
    const second = computeConfidence(input);

    expect(first).toEqual(second);
  });
});
