import { describe, expect, it } from 'vitest';

import { computeSynthesisConfidence } from './synthesis-confidence.ts';
import type { LinkedInvestigationProjection, SynthesisConflict } from './synthesis-types.ts';

function linked(input: {
  investigationRunId: string;
  status: string;
  band: 'low' | 'medium' | 'high';
}): LinkedInvestigationProjection {
  return {
    investigationRunId: input.investigationRunId,
    investigationDefinitionId: 'protocol-risk-investigation',
    sourceSignalType: 'protocol_risk',
    sourceSignalReference: `signal-${input.investigationRunId}`,
    status: input.status,
    findings: ['protocol_risk:aave:high'],
    reportConfidenceBand: input.band,
    readinessState: input.status === 'completed' ? 'complete' : 'still_evolving',
    convergenceState: input.status === 'completed' ? 'stable' : 'still_evolving',
    healthState: 'healthy',
    blockingReasons: [],
    strengths: [],
    limitations: []
  };
}

const conflict: SynthesisConflict = {
  conflictId: 'c1',
  summary: 'conflicting findings for protocol_risk:aave: high vs low',
  conflictingInvestigationIds: ['run-1', 'run-2'],
  conflictingFindingIds: ['protocol_risk:aave:high', 'protocol_risk:aave:low']
};

describe('synthesis confidence', () => {
  it('T-SYN-C1 reinforcing completed investigations produce higher confidence', () => {
    const summary = computeSynthesisConfidence({
      linkedInvestigations: [
        linked({ investigationRunId: 'run-1', status: 'completed', band: 'high' }),
        linked({ investigationRunId: 'run-2', status: 'completed', band: 'high' })
      ],
      reinforcingInvestigationIds: ['run-1', 'run-2'],
      conflicts: [],
      unresolvedLimitations: []
    });

    expect(summary.overallBand).toBe('high');
    expect(summary.weakeningFactors).toEqual([]);
  });

  it('T-SYN-C2 conflicts weaken synthesis confidence deterministically', () => {
    const summary = computeSynthesisConfidence({
      linkedInvestigations: [
        linked({ investigationRunId: 'run-1', status: 'completed', band: 'high' }),
        linked({ investigationRunId: 'run-2', status: 'completed', band: 'medium' })
      ],
      reinforcingInvestigationIds: ['run-1', 'run-2'],
      conflicts: [conflict],
      unresolvedLimitations: ['counter_evidence_present']
    });

    expect(summary.overallBand).toBe('medium');
    expect(summary.unresolvedConflicts).toContain(conflict.summary);
    expect(summary.weakeningFactors.some((factor) => factor.includes('material conflicts'))).toBe(true);
  });

  it('T-SYN-C3 incomplete linked investigations reduce confidence strength', () => {
    const summary = computeSynthesisConfidence({
      linkedInvestigations: [
        linked({ investigationRunId: 'run-1', status: 'completed', band: 'medium' }),
        linked({ investigationRunId: 'run-2', status: 'running', band: 'low' })
      ],
      reinforcingInvestigationIds: ['run-1'],
      conflicts: [],
      unresolvedLimitations: ['awaiting_additional_cycle_confirmation']
    });

    expect(summary.weakeningFactors.some((factor) => factor.includes('incomplete investigations'))).toBe(true);
    expect(summary.overallBand).not.toBe('high');
  });
});
