import { describe, expect, it } from 'vitest';

import { classifySynthesisConflicts } from './synthesis-conflict-classifier.ts';
import type { LinkedInvestigationProjection } from './synthesis-types.ts';

function linked(input: {
  id: string;
  finding: string;
  status?: string;
  readiness?: string;
  band?: 'low' | 'medium' | 'high';
  limitations?: string[];
}): LinkedInvestigationProjection {
  return {
    investigationRunId: input.id,
    investigationDefinitionId: 'protocol-risk-investigation',
    sourceSignalType: 'protocol_risk',
    sourceSignalReference: `signal-${input.id}`,
    status: input.status ?? 'completed',
    findings: [input.finding],
    reportConfidenceBand: input.band ?? 'high',
    readinessState: input.readiness ?? 'complete',
    convergenceState: 'stable',
    healthState: 'healthy',
    blockingReasons: [],
    strengths: [],
    limitations: input.limitations ?? []
  };
}

describe('synthesis conflict classifier', () => {
  it('T-SYN-CF1 classifies direct finding conflicts deterministically', () => {
    const conflicts = classifySynthesisConflicts({
      synthesisId: 'syn-1',
      linkedInvestigations: [
        linked({ id: 'run-1', finding: 'protocol_risk:aave:high' }),
        linked({ id: 'run-2', finding: 'protocol_risk:aave:low' })
      ]
    });

    expect(conflicts.some((entry) => entry.type === 'direct_finding_conflict')).toBe(true);
  });

  it('T-SYN-CF2 classifies confidence mismatch for materially different bands', () => {
    const conflicts = classifySynthesisConflicts({
      synthesisId: 'syn-1',
      linkedInvestigations: [
        linked({ id: 'run-1', finding: 'protocol_risk:aave:high', band: 'high' }),
        linked({ id: 'run-2', finding: 'protocol_risk:aave:high', band: 'low' })
      ]
    });

    expect(conflicts.some((entry) => entry.type === 'confidence_mismatch')).toBe(true);
  });

  it('T-SYN-CF3 classifies support imbalance for singly supported findings', () => {
    const conflicts = classifySynthesisConflicts({
      synthesisId: 'syn-1',
      linkedInvestigations: [
        linked({ id: 'run-1', finding: 'protocol_risk:aave:high' }),
        linked({ id: 'run-2', finding: 'protocol_risk:morpho:high' }),
        linked({ id: 'run-3', finding: 'protocol_risk:maker:high' })
      ]
    });

    expect(conflicts.some((entry) => entry.type === 'support_imbalance')).toBe(true);
  });

  it('T-SYN-CF4 classifies unresolved component limitations and incomplete dependencies', () => {
    const conflicts = classifySynthesisConflicts({
      synthesisId: 'syn-1',
      linkedInvestigations: [
        linked({ id: 'run-1', finding: 'protocol_risk:aave:high', limitations: ['missing_evidence'] }),
        linked({ id: 'run-2', finding: 'protocol_risk:aave:high', status: 'running', readiness: 'still_evolving' })
      ]
    });

    expect(conflicts.some((entry) => entry.type === 'unresolved_component_limitations')).toBe(true);
    expect(conflicts.some((entry) => entry.type === 'incomplete_component_dependency')).toBe(true);
  });

  it('T-SYN-CF5 conflict output remains stable across repeated runs', () => {
    const input = {
      synthesisId: 'syn-1',
      linkedInvestigations: [
        linked({ id: 'run-1', finding: 'protocol_risk:aave:high', band: 'high' }),
        linked({ id: 'run-2', finding: 'protocol_risk:aave:low', band: 'low' })
      ]
    };

    const first = classifySynthesisConflicts(input);
    const second = classifySynthesisConflicts(input);

    expect(first).toEqual(second);
  });
});
