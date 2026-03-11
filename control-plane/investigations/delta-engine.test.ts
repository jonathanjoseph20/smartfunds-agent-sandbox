import { describe, expect, it } from 'vitest';

import { computeInvestigationDelta } from './investigation-delta-engine.ts';
import type { FindingSnapshot } from './revision-types.ts';

function snapshot(input: {
  findingId: string;
  confidenceBand: 'low' | 'medium' | 'high';
  support?: number;
  counter?: number;
  gaps?: number;
}): FindingSnapshot {
  return {
    findingId: input.findingId,
    confidenceBand: input.confidenceBand,
    supportCount: input.support ?? 1,
    counterEvidenceCount: input.counter ?? 0,
    unresolvedGapCount: input.gaps ?? 0
  };
}

describe('investigation delta engine', () => {
  it('T-INV-DE1 classifies finding added', () => {
    const delta = computeInvestigationDelta({
      investigationRunId: 'run-1',
      revisionId: 'revision-0001',
      nextFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium' })]
    });

    expect(delta.deltas[0]?.changeType).toBe('added');
  });

  it('T-INV-DE2 classifies finding removed', () => {
    const delta = computeInvestigationDelta({
      investigationRunId: 'run-1',
      revisionId: 'revision-0002',
      previousRevisionId: 'revision-0001',
      priorFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium' })],
      nextFindings: []
    });

    expect(delta.deltas[0]?.changeType).toBe('removed');
  });

  it('T-INV-DE3 classifies confidence increased and decreased', () => {
    const increased = computeInvestigationDelta({
      investigationRunId: 'run-1',
      revisionId: 'revision-0002',
      previousRevisionId: 'revision-0001',
      priorFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'low' })],
      nextFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium' })]
    });
    const decreased = computeInvestigationDelta({
      investigationRunId: 'run-1',
      revisionId: 'revision-0003',
      previousRevisionId: 'revision-0002',
      priorFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'high' })],
      nextFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium' })]
    });

    expect(increased.deltas[0]?.changeType).toBe('confidence_increased');
    expect(decreased.deltas[0]?.changeType).toBe('confidence_decreased');
  });

  it('T-INV-DE4 classifies support strengthening', () => {
    const delta = computeInvestigationDelta({
      investigationRunId: 'run-1',
      revisionId: 'revision-0002',
      previousRevisionId: 'revision-0001',
      priorFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium', support: 1 })],
      nextFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium', support: 2 })]
    });

    expect(delta.deltas[0]?.changeType).toBe('support_strengthened');
  });

  it('T-INV-DE5 classifies counter evidence added', () => {
    const delta = computeInvestigationDelta({
      investigationRunId: 'run-1',
      revisionId: 'revision-0002',
      previousRevisionId: 'revision-0001',
      priorFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium', counter: 0 })],
      nextFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium', counter: 1 })]
    });

    expect(delta.deltas[0]?.changeType).toBe('counter_evidence_added');
  });

  it('T-INV-DE6 classifies gap resolved and gap added', () => {
    const resolved = computeInvestigationDelta({
      investigationRunId: 'run-1',
      revisionId: 'revision-0002',
      previousRevisionId: 'revision-0001',
      priorFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium', gaps: 2 })],
      nextFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium', gaps: 1 })]
    });

    const added = computeInvestigationDelta({
      investigationRunId: 'run-1',
      revisionId: 'revision-0003',
      previousRevisionId: 'revision-0002',
      priorFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium', gaps: 0 })],
      nextFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium', gaps: 1 })]
    });

    expect(resolved.deltas[0]?.changeType).toBe('gap_resolved');
    expect(added.deltas[0]?.changeType).toBe('gap_added');
  });

  it('T-INV-DE7 classifies unchanged deterministically', () => {
    const delta = computeInvestigationDelta({
      investigationRunId: 'run-1',
      revisionId: 'revision-0002',
      previousRevisionId: 'revision-0001',
      priorFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium', support: 1, counter: 0, gaps: 0 })],
      nextFindings: [snapshot({ findingId: 'f-a', confidenceBand: 'medium', support: 1, counter: 0, gaps: 0 })]
    });

    expect(delta.deltas[0]?.changeType).toBe('unchanged');
  });
});
