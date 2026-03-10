import { describe, expect, it } from 'vitest';

import { createInvestigationRegistry } from './investigation-registry.ts';
import { buildInvestigationConfidenceProjection } from './findings.ts';
import type { EvidenceRecord } from './evidence-types.ts';

function evidence(input: {
  evidenceId: string;
  evidenceType: EvidenceRecord['evidenceType'];
  findingIds: string[];
}): EvidenceRecord {
  return {
    evidenceId: input.evidenceId,
    investigationRunId: 'run-1',
    phaseId: 'gather',
    evidenceType: input.evidenceType,
    summary: input.evidenceId,
    payload: {},
    findingIds: input.findingIds
  };
}

describe('investigation findings projection', () => {
  it('T-INV-F1 links supporting/counter/gap evidence and confidence deterministically', () => {
    const definition = createInvestigationRegistry().getInvestigation('liquidity-drain-investigation');
    const projection = buildInvestigationConfidenceProjection({
      investigationRunId: 'run-1',
      definition,
      findings: ['finding-1'],
      evidence: [
        evidence({ evidenceId: 's1', evidenceType: 'raw_observation', findingIds: ['finding-1'] }),
        evidence({ evidenceId: 'c1', evidenceType: 'counter_evidence', findingIds: ['finding-1'] }),
        evidence({ evidenceId: 'g1', evidenceType: 'unresolved_gap', findingIds: ['finding-1'] })
      ]
    });

    expect(projection.findings).toHaveLength(1);
    expect(projection.findings[0].supportingEvidenceIds).toEqual(['s1']);
    expect(projection.findings[0].counterEvidenceIds).toEqual(['c1']);
    expect(projection.findings[0].unresolvedGapIds).toEqual(['g1']);
    expect(projection.findings[0].confidenceReason).toContain('score=');
  });

  it('T-INV-F2 report confidence reason is internally consistent with score and band', () => {
    const definition = createInvestigationRegistry().getInvestigation('liquidity-drain-investigation');
    const projection = buildInvestigationConfidenceProjection({
      investigationRunId: 'run-1',
      definition,
      findings: ['finding-1'],
      evidence: [
        evidence({ evidenceId: 's1', evidenceType: 'raw_observation', findingIds: ['finding-1'] }),
        evidence({ evidenceId: 's2', evidenceType: 'derived_metric', findingIds: ['finding-1'] })
      ]
    });

    expect(projection.reportConfidence.confidenceReason).toBe(
      `score=${String(projection.reportConfidence.confidenceScore)} band=${projection.reportConfidence.confidenceBand}`
    );
  });
});
