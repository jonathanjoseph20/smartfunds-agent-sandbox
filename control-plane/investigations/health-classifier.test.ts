import { describe, expect, it } from 'vitest';

import { classifyInvestigationHealth } from './health-classifier.ts';
import type { CompletionConfidenceMetrics, CompletionEvidenceMetrics, CompletionLifecycleSnapshot } from './completion-types.ts';
import type { InvestigationDelta, InvestigationRevisionRecord } from './revision-types.ts';

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

function delta(changeType: InvestigationDelta['deltas'][number]['changeType']): InvestigationDelta {
  return {
    investigationRunId: 'run-1',
    revisionId: 'revision-0002',
    previousRevisionId: 'revision-0001',
    deltas: [{ findingId: 'f1', changeType, reason: changeType }]
  };
}

function input(overrides: {
  lifecycle?: CompletionLifecycleSnapshot;
  confidence?: CompletionConfidenceMetrics;
  evidence?: CompletionEvidenceMetrics;
  revisions?: InvestigationRevisionRecord[];
  deltas?: InvestigationDelta[];
} = {}) {
  return {
    lifecycle: overrides.lifecycle ?? { status: 'running', completedPhaseIds: [] },
    confidence: overrides.confidence ?? { reportConfidenceBand: 'medium', reportConfidenceScore: 55, trend: 'flat' },
    evidence: overrides.evidence ?? {
      supportingEvidenceCount: 2,
      counterEvidenceCount: 0,
      unresolvedGapCount: 0,
      unresolvedCriticalGapCount: 0
    },
    revisions: overrides.revisions ?? [revision(1), revision(2)],
    deltas: overrides.deltas ?? [delta('support_strengthened')]
  };
}

describe('health classifier', () => {
  it('T-INV-HLT1 classifies healthy while running with supporting evidence and no critical gaps', () => {
    expect(classifyInvestigationHealth(input())).toBe('healthy');
  });

  it('T-INV-HLT2 classifies waiting_normally for deterministic dataset waits', () => {
    expect(classifyInvestigationHealth(input({
      lifecycle: { status: 'awaiting_data', completedPhaseIds: [], waitingReason: 'awaiting_new_dataset_observation' }
    }))).toBe('waiting_normally');
  });

  it('T-INV-HLT3 classifies retrying for retry_pending lifecycle', () => {
    expect(classifyInvestigationHealth(input({
      lifecycle: { status: 'retry_pending', completedPhaseIds: [] }
    }))).toBe('retrying');
  });

  it('T-INV-HLT4 classifies blocked_by_missing_evidence when critical gaps exist', () => {
    expect(classifyInvestigationHealth(input({
      evidence: {
        supportingEvidenceCount: 1,
        counterEvidenceCount: 0,
        unresolvedGapCount: 1,
        unresolvedCriticalGapCount: 1
      }
    }))).toBe('blocked_by_missing_evidence');
  });

  it('T-INV-HLT5 classifies degraded_by_counter_evidence when counter evidence degrades confidence', () => {
    expect(classifyInvestigationHealth(input({
      confidence: { reportConfidenceBand: 'medium', reportConfidenceScore: 50, trend: 'degrading' },
      evidence: {
        supportingEvidenceCount: 2,
        counterEvidenceCount: 1,
        unresolvedGapCount: 0,
        unresolvedCriticalGapCount: 0
      },
      deltas: [delta('counter_evidence_added')]
    }))).toBe('degraded_by_counter_evidence');
  });

  it('T-INV-HLT6 classifies stalled for repeated unchanged revisions with flat confidence', () => {
    expect(classifyInvestigationHealth(input({
      lifecycle: { status: 'running', completedPhaseIds: [] },
      confidence: { reportConfidenceBand: 'medium', reportConfidenceScore: 55, trend: 'flat' },
      revisions: [revision(1), revision(2), revision(3)],
      deltas: [delta('unchanged'), delta('unchanged')]
    }))).toBe('stalled');
  });

  it('T-INV-HLT7 classifies inconclusive for contradictory mixed evidence', () => {
    expect(classifyInvestigationHealth(input({
      confidence: { reportConfidenceBand: 'medium', reportConfidenceScore: 55, trend: 'mixed' },
      evidence: {
        supportingEvidenceCount: 2,
        counterEvidenceCount: 1,
        unresolvedGapCount: 0,
        unresolvedCriticalGapCount: 0
      }
    }))).toBe('inconclusive');
  });
});

