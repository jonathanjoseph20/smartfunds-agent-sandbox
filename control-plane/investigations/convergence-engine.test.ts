import { describe, expect, it } from 'vitest';

import { evaluateInvestigationConvergence } from './convergence-engine.ts';
import type { ConfidenceSnapshot, InvestigationDelta, InvestigationRevisionRecord } from './revision-types.ts';

function revision(number: number): InvestigationRevisionRecord {
  return {
    revisionId: `revision-${String(number).padStart(4, '0')}`,
    investigationRunId: 'run-1',
    revisionNumber: number,
    reportPath: '/tmp/report.md',
    findingsSnapshotPath: '/tmp/findings.json',
    confidenceSnapshotPath: '/tmp/confidence.json'
  };
}

function confidence(score: number): ConfidenceSnapshot {
  return {
    investigationRunId: 'run-1',
    reportConfidenceBand: score >= 70 ? 'high' : (score >= 45 ? 'medium' : 'low'),
    reportConfidenceScore: score,
    reportStrengths: [],
    reportLimitations: [],
    findings: []
  };
}

function delta(changeType: InvestigationDelta['deltas'][number]['changeType']): InvestigationDelta {
  return {
    investigationRunId: 'run-1',
    revisionId: 'revision-0002',
    previousRevisionId: 'revision-0001',
    deltas: [{ findingId: 'f1', changeType, reason: changeType }]
  };
}

describe('convergence engine', () => {
  it('T-INV-CVG1 classifies stable for three unchanged revisions with fixed confidence', () => {
    const state = evaluateInvestigationConvergence({
      revisions: [revision(1), revision(2), revision(3)],
      confidenceSnapshots: [confidence(60), confidence(60), confidence(60)],
      deltas: [delta('unchanged'), delta('unchanged')]
    });

    expect(state).toBe('stable');
  });

  it('T-INV-CVG2 classifies converging for improving confidence without new critical gaps or counter evidence', () => {
    const state = evaluateInvestigationConvergence({
      revisions: [revision(1), revision(2)],
      confidenceSnapshots: [confidence(55), confidence(60)],
      deltas: [delta('support_strengthened')]
    });

    expect(state).toBe('converging');
  });

  it('T-INV-CVG3 classifies still_evolving when material findings are added', () => {
    const state = evaluateInvestigationConvergence({
      revisions: [revision(1), revision(2)],
      confidenceSnapshots: [confidence(60), confidence(60)],
      deltas: [delta('added')]
    });

    expect(state).toBe('still_evolving');
  });

  it('T-INV-CVG4 classifies diverging when confidence drops or counter evidence is added', () => {
    const dropping = evaluateInvestigationConvergence({
      revisions: [revision(1), revision(2)],
      confidenceSnapshots: [confidence(60), confidence(50)],
      deltas: [delta('unchanged')]
    });
    const counter = evaluateInvestigationConvergence({
      revisions: [revision(1), revision(2)],
      confidenceSnapshots: [confidence(60), confidence(60)],
      deltas: [delta('counter_evidence_added')]
    });

    expect(dropping).toBe('diverging');
    expect(counter).toBe('diverging');
  });

  it('T-INV-CVG5 classifies inconclusive with insufficient history', () => {
    const state = evaluateInvestigationConvergence({
      revisions: [revision(1)],
      confidenceSnapshots: [confidence(60)],
      deltas: []
    });

    expect(state).toBe('inconclusive');
  });
});

