import { describe, expect, it } from 'vitest';

import { computeConfidenceTrend } from './confidence-trend.ts';
import { evaluateInvestigationContinuity } from './investigation-continuity.ts';
import type { ConfidenceSnapshot, InvestigationDelta, InvestigationRevisionRecord } from './revision-types.ts';

function revision(revisionNumber: number): InvestigationRevisionRecord {
  return {
    revisionId: `revision-${String(revisionNumber).padStart(4, '0')}`,
    investigationRunId: 'run-1',
    revisionNumber,
    reportPath: '/tmp/report.md',
    findingsSnapshotPath: `/tmp/revision-${String(revisionNumber).padStart(4, '0')}/findings-snapshot.json`,
    confidenceSnapshotPath: `/tmp/revision-${String(revisionNumber).padStart(4, '0')}/confidence-snapshot.json`,
    deltaPath: `/tmp/revision-${String(revisionNumber).padStart(4, '0')}/delta.json`,
    continuitySummaryPath: `/tmp/revision-${String(revisionNumber).padStart(4, '0')}/continuity-summary.json`
  };
}

function confidence(score: number, limitations: string[] = []): ConfidenceSnapshot {
  return {
    investigationRunId: 'run-1',
    reportConfidenceBand: score >= 70 ? 'high' : (score >= 45 ? 'medium' : 'low'),
    reportConfidenceScore: score,
    reportStrengths: [],
    reportLimitations: limitations,
    findings: []
  };
}

function delta(changeType: InvestigationDelta['deltas'][number]['changeType']): InvestigationDelta {
  return {
    investigationRunId: 'run-1',
    revisionId: 'revision-0002',
    previousRevisionId: 'revision-0001',
    deltas: [{
      findingId: 'finding-a',
      changeType,
      reason: changeType
    }]
  };
}

describe('investigation continuity and trend', () => {
  it('T-INV-CT1 classifies stable when only unchanged deltas exist', () => {
    const summary = evaluateInvestigationContinuity({
      investigationRunId: 'run-1',
      revisions: [revision(1), revision(2)],
      latestDelta: delta('unchanged'),
      confidenceSnapshots: [confidence(60), confidence(60)]
    });

    expect(summary.continuityState).toBe('stable');
  });

  it('T-INV-CT2 classifies evolving for non-material support changes', () => {
    const summary = evaluateInvestigationContinuity({
      investigationRunId: 'run-1',
      revisions: [revision(1), revision(2)],
      latestDelta: delta('support_strengthened'),
      confidenceSnapshots: [confidence(60), confidence(65)]
    });

    expect(summary.continuityState).toBe('evolving');
  });

  it('T-INV-CT3 classifies materially changed for material deltas', () => {
    const summary = evaluateInvestigationContinuity({
      investigationRunId: 'run-1',
      revisions: [revision(1), revision(2)],
      latestDelta: delta('added'),
      confidenceSnapshots: [confidence(60), confidence(60)]
    });

    expect(summary.continuityState).toBe('materially_changed');
  });

  it('T-INV-CT4 classifies inconclusive when there is only one revision', () => {
    const summary = evaluateInvestigationContinuity({
      investigationRunId: 'run-1',
      revisions: [revision(1)],
      latestDelta: {
        investigationRunId: 'run-1',
        revisionId: 'revision-0001',
        deltas: [{ findingId: 'finding-a', changeType: 'added', reason: 'added' }]
      },
      confidenceSnapshots: [confidence(50, ['unresolved gaps: 1'])]
    });

    expect(summary.continuityState).toBe('inconclusive');
    expect(summary.unresolvedLimitations).toEqual(['unresolved gaps: 1']);
  });

  it('T-INV-CT5 classifies confidence trend improving, degrading, flat, and mixed', () => {
    expect(computeConfidenceTrend([confidence(50), confidence(60), confidence(70)])).toBe('improving');
    expect(computeConfidenceTrend([confidence(70), confidence(60), confidence(50)])).toBe('degrading');
    expect(computeConfidenceTrend([confidence(55), confidence(55), confidence(55)])).toBe('flat');
    expect(computeConfidenceTrend([confidence(55), confidence(65), confidence(60)])).toBe('mixed');
  });
});
