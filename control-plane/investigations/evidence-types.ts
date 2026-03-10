export const EVIDENCE_TYPES = [
  'raw_observation',
  'derived_metric',
  'cross_cycle_confirmation',
  'contextual_support',
  'counter_evidence',
  'unresolved_gap'
] as const;

export type EvidenceType = typeof EVIDENCE_TYPES[number];

export type EvidenceRecord = {
  evidenceId: string;
  investigationRunId: string;
  phaseId: string;
  evidenceType: EvidenceType;
  sourceArtifactPath?: string;
  sourceDatasetKey?: string;
  summary: string;
  payload: Record<string, unknown>;
  findingIds: string[];
};

export type ConfidenceBand = 'low' | 'medium' | 'high';

export type ConfidenceSummary = {
  confidenceBand: ConfidenceBand;
  confidenceScore: number;
  confidenceReason: string;
  strengths: string[];
  limitations: string[];
};

export type InvestigationFinding = {
  findingId: string;
  title: string;
  summary: string;
  supportingEvidenceIds: string[];
  counterEvidenceIds: string[];
  unresolvedGapIds: string[];
  confidenceBand: ConfidenceBand;
  confidenceScore: number;
  confidenceReason: string;
  strengths: string[];
  limitations: string[];
};

export type InvestigationConfidenceProjection = {
  investigationRunId: string;
  findings: InvestigationFinding[];
  reportConfidence: ConfidenceSummary;
  confidenceByPhase: Array<{
    phaseId: string;
    confidenceBand: ConfidenceBand;
    confidenceScore: number;
  }>;
};
