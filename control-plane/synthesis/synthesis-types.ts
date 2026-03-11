import type { ConfidenceBand } from '../investigations/revision-types.ts';

export const SYNTHESIS_STATUSES = [
  'pending',
  'active',
  'completed',
  'inconclusive'
] as const;

export const SYNTHESIS_DIMENSIONS = [
  'protocol',
  'asset',
  'trigger_family',
  'signal_type',
  'subject_tag'
] as const;

export type SynthesisStatus = typeof SYNTHESIS_STATUSES[number];
export type SynthesisDimension = typeof SYNTHESIS_DIMENSIONS[number];

export type SynthesisDefinition = {
  synthesisType: string;
  description: string;
  supportedDimensions: SynthesisDimension[];
  sourceSignalTypes: string[];
  sourceInvestigationDefinitionIds: string[];
};

export type SynthesisLinkReason = {
  dimension: SynthesisDimension;
  value: string;
  reason: string;
};

export type SynthesisIdentity = {
  synthesisType: string;
  subjectKey: string;
};

export type SynthesisRecord = {
  synthesisId: string;
  synthesisType: string;
  subjectKey: string;
  status: SynthesisStatus;
  linkedInvestigationIds: string[];
  linkedReasons: SynthesisLinkReason[];
  latestArtifactPaths: string[];
  latestConfidenceBand?: ConfidenceBand;
};

export type SynthesisEvent =
  | {
    eventType: 'SYNTHESIS_SET_CREATED';
    synthesisId: string;
    synthesisType: string;
    subjectKey: string;
    status: SynthesisStatus;
    linkedInvestigationIds: string[];
    linkedReasons: SynthesisLinkReason[];
  }
  | {
    eventType: 'SYNTHESIS_LINKS_UPDATED';
    synthesisId: string;
    linkedInvestigationIds: string[];
    linkedReasons: SynthesisLinkReason[];
  }
  | {
    eventType: 'SYNTHESIS_STATUS_UPDATED';
    synthesisId: string;
    status: SynthesisStatus;
    reason: string;
  }
  | {
    eventType: 'SYNTHESIS_ARTIFACT_RECORDED';
    synthesisId: string;
    artifactPath: string;
    artifactKind: 'json' | 'markdown';
  }
  | {
    eventType: 'SYNTHESIS_CONFIDENCE_UPDATED';
    synthesisId: string;
    overallBand: ConfidenceBand;
  };

export type SynthesisEventRecord = SynthesisEvent & {
  sequence: number;
  logDate: string;
};

export type LinkedInvestigationProjection = {
  investigationRunId: string;
  investigationDefinitionId: string;
  sourceSignalType: string;
  sourceSignalReference: string;
  sourceTriggerId?: string;
  status: string;
  findings: string[];
  reportConfidenceBand: ConfidenceBand;
  readinessState: string;
  convergenceState: string;
  healthState: string;
  blockingReasons: string[];
  strengths: string[];
  limitations: string[];
};

export type SynthesisFinding = {
  findingId: string;
  title: string;
  summary: string;
  supportingInvestigationIds: string[];
  conflictingInvestigationIds: string[];
  supportingFindingIds: string[];
  conflictingFindingIds: string[];
  confidenceBand: ConfidenceBand;
  strengths: string[];
  limitations: string[];
};

export type SynthesisConflict = {
  conflictId: string;
  summary: string;
  conflictingInvestigationIds: string[];
  conflictingFindingIds: string[];
};

export type SynthesisConfidenceSummary = {
  overallBand: ConfidenceBand;
  supportingFactors: string[];
  weakeningFactors: string[];
  unresolvedConflicts: string[];
};

export type SynthesisReport = {
  synthesisId: string;
  synthesisType: string;
  subjectKey: string;
  status: SynthesisStatus;
  linkedInvestigations: LinkedInvestigationProjection[];
  linkedReasons: SynthesisLinkReason[];
  findings: SynthesisFinding[];
  confidence: SynthesisConfidenceSummary;
  reinforcingInvestigationIds: string[];
  conflictingInvestigationIds: string[];
  conflicts: SynthesisConflict[];
  unresolvedLimitations: string[];
  artifactPaths: string[];
  conclusion: string;
};

export class SynthesisError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SynthesisError';
    this.code = code;
  }
}
