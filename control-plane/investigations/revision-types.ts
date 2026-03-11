import type { InvestigationFinding } from './evidence-types.ts';

export type ConfidenceBand = 'low' | 'medium' | 'high';

export interface InvestigationRevisionRecord {
  revisionId: string;
  investigationRunId: string;
  revisionNumber: number;
  slotReference?: string;
  reportPath: string;
  findingsSnapshotPath: string;
  confidenceSnapshotPath: string;
  deltaPath?: string;
  continuitySummaryPath?: string;
}

export interface FindingSnapshot {
  findingId: string;
  confidenceBand: ConfidenceBand;
  supportCount: number;
  counterEvidenceCount: number;
  unresolvedGapCount: number;
}

export interface ConfidenceSnapshot {
  investigationRunId: string;
  reportConfidenceBand: ConfidenceBand;
  reportConfidenceScore: number;
  reportStrengths: string[];
  reportLimitations: string[];
  findings: Array<{
    findingId: string;
    confidenceBand: ConfidenceBand;
    confidenceScore: number;
  }>;
}

export interface FindingDelta {
  findingId: string;
  changeType:
    | 'added'
    | 'removed'
    | 'confidence_increased'
    | 'confidence_decreased'
    | 'support_strengthened'
    | 'counter_evidence_added'
    | 'gap_resolved'
    | 'gap_added'
    | 'unchanged';
  priorConfidenceBand?: ConfidenceBand;
  nextConfidenceBand?: ConfidenceBand;
  reason: string;
}

export interface InvestigationDelta {
  investigationRunId: string;
  revisionId: string;
  previousRevisionId?: string;
  deltas: FindingDelta[];
}

export interface InvestigationContinuitySummary {
  investigationRunId: string;
  revisionCount: number;
  continuityState:
    | 'stable'
    | 'evolving'
    | 'inconclusive'
    | 'materially_changed';
  confidenceTrend:
    | 'improving'
    | 'degrading'
    | 'flat'
    | 'mixed';
  majorChanges: string[];
  unresolvedLimitations: string[];
}

export function toFindingSnapshot(finding: InvestigationFinding): FindingSnapshot {
  return {
    findingId: finding.findingId,
    confidenceBand: finding.confidenceBand,
    supportCount: finding.supportingEvidenceIds.length,
    counterEvidenceCount: finding.counterEvidenceIds.length,
    unresolvedGapCount: finding.unresolvedGapIds.length
  };
}
