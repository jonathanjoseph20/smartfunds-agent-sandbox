import { computeConfidence } from './confidence-engine.ts';
import type {
  EvidenceRecord,
  InvestigationConfidenceProjection,
  InvestigationFinding,
} from './evidence-types.ts';
import type { InvestigationDefinition } from './investigation-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function classifyEvidenceForFinding(input: {
  findingId: string;
  evidence: EvidenceRecord[];
}): {
  supporting: EvidenceRecord[];
  counter: EvidenceRecord[];
  gaps: EvidenceRecord[];
} {
  const linked = input.evidence.filter((record) => record.findingIds.includes(input.findingId));
  return {
    supporting: linked.filter((record) => record.evidenceType !== 'counter_evidence' && record.evidenceType !== 'unresolved_gap'),
    counter: linked.filter((record) => record.evidenceType === 'counter_evidence'),
    gaps: linked.filter((record) => record.evidenceType === 'unresolved_gap')
  };
}

function findingTitle(findingId: string): string {
  return findingId.replace(/[:_]/g, ' ');
}

function findingSummary(findingId: string): string {
  return `Finding ${findingId}`;
}

function sortEvidence(records: EvidenceRecord[]): EvidenceRecord[] {
  return [...records].sort((left, right) => {
    const typeCmp = left.evidenceType.localeCompare(right.evidenceType);
    if (typeCmp !== 0) {
      return typeCmp;
    }
    const phaseCmp = left.phaseId.localeCompare(right.phaseId);
    if (phaseCmp !== 0) {
      return phaseCmp;
    }
    return left.evidenceId.localeCompare(right.evidenceId);
  });
}

function sortedFindings(findings: string[]): string[] {
  return [...findings].sort((left, right) => left.localeCompare(right));
}

function buildFinding(input: {
  findingId: string;
  evidence: EvidenceRecord[];
}): InvestigationFinding {
  const evidence = classifyEvidenceForFinding({ findingId: input.findingId, evidence: input.evidence });
  const confidence = computeConfidence({
    supportingEvidence: evidence.supporting,
    counterEvidence: evidence.counter,
    unresolvedGaps: evidence.gaps
  });

  return {
    findingId: input.findingId,
    title: findingTitle(input.findingId),
    summary: findingSummary(input.findingId),
    supportingEvidenceIds: uniqueSorted(evidence.supporting.map((record) => record.evidenceId)),
    counterEvidenceIds: uniqueSorted(evidence.counter.map((record) => record.evidenceId)),
    unresolvedGapIds: uniqueSorted(evidence.gaps.map((record) => record.evidenceId)),
    confidenceBand: confidence.confidenceBand,
    confidenceScore: confidence.confidenceScore,
    confidenceReason: confidence.confidenceReason,
    strengths: confidence.strengths,
    limitations: confidence.limitations
  };
}

export function buildInvestigationConfidenceProjection(input: {
  investigationRunId: string;
  definition: InvestigationDefinition;
  findings: string[];
  evidence: EvidenceRecord[];
}): InvestigationConfidenceProjection {
  const evidence = sortEvidence(input.evidence);
  const findings = sortedFindings(input.findings).map((findingId) => buildFinding({ findingId, evidence }));
  const reportConfidence = computeConfidence({
    supportingEvidence: evidence.filter((record) => record.evidenceType !== 'counter_evidence' && record.evidenceType !== 'unresolved_gap'),
    counterEvidence: evidence.filter((record) => record.evidenceType === 'counter_evidence'),
    unresolvedGaps: evidence.filter((record) => record.evidenceType === 'unresolved_gap')
  });

  const phaseOrder = new Map(input.definition.phases.map((phase, index) => [phase.phaseId, index]));
  const phaseRows = input.definition.phases
    .map((phase) => {
      const uptoEvidence = evidence.filter((record) => (phaseOrder.get(record.phaseId) ?? Number.MAX_SAFE_INTEGER) <= (phaseOrder.get(phase.phaseId) ?? Number.MAX_SAFE_INTEGER));
      const confidence = computeConfidence({
        supportingEvidence: uptoEvidence.filter((record) => record.evidenceType !== 'counter_evidence' && record.evidenceType !== 'unresolved_gap'),
        counterEvidence: uptoEvidence.filter((record) => record.evidenceType === 'counter_evidence'),
        unresolvedGaps: uptoEvidence.filter((record) => record.evidenceType === 'unresolved_gap')
      });
      return {
        phaseId: phase.phaseId,
        confidenceBand: confidence.confidenceBand,
        confidenceScore: confidence.confidenceScore
      };
    });

  return {
    investigationRunId: input.investigationRunId,
    findings,
    reportConfidence,
    confidenceByPhase: phaseRows
  };
}
