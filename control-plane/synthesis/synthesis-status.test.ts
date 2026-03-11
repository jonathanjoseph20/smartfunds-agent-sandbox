import { describe, expect, it } from 'vitest';

import { evaluateSynthesisStatus } from './synthesis-status.ts';
import type { SynthesisConflict } from './synthesis-conflict-classifier.ts';
import type { LinkedInvestigationProjection } from './synthesis-types.ts';

function linked(input: {
  id: string;
  status?: string;
  readiness?: string;
  findings?: string[];
  limitations?: string[];
  blockingReasons?: string[];
}): LinkedInvestigationProjection {
  return {
    investigationRunId: input.id,
    investigationDefinitionId: 'protocol-risk-investigation',
    sourceSignalType: 'protocol_risk',
    sourceSignalReference: `signal-${input.id}`,
    status: input.status ?? 'completed',
    findings: input.findings ?? ['protocol_risk:aave:high'],
    reportConfidenceBand: 'high',
    readinessState: input.readiness ?? 'complete',
    convergenceState: 'stable',
    healthState: 'healthy',
    blockingReasons: input.blockingReasons ?? [],
    strengths: [],
    limitations: input.limitations ?? []
  };
}

function conflict(): SynthesisConflict {
  return {
    conflictId: 'c1',
    type: 'direct_finding_conflict',
    investigationIds: ['run-1', 'run-2'],
    findingIds: ['protocol_risk:aave:high', 'protocol_risk:aave:low'],
    summary: 'direct conflict'
  };
}

describe('synthesis status evaluator', () => {
  it('T-SYN-ST1 classifies pending when no linked investigations exist', () => {
    const status = evaluateSynthesisStatus({
      synthesisId: 'syn-1',
      linkedInvestigations: [],
      conflicts: [],
      materialized: false
    });

    expect(status.readinessState).toBe('pending');
    expect(status.blockingReasons).toContain('no_linked_investigations');
  });

  it('T-SYN-ST2 classifies active when linked investigations are incomplete', () => {
    const status = evaluateSynthesisStatus({
      synthesisId: 'syn-1',
      linkedInvestigations: [linked({ id: 'run-1', status: 'running', readiness: 'still_evolving' })],
      conflicts: [],
      materialized: false
    });

    expect(status.readinessState).toBe('active');
    expect(status.blockingReasons).toContain('no_completed_investigations');
  });

  it('T-SYN-ST3 classifies incomplete when completed support is insufficient', () => {
    const status = evaluateSynthesisStatus({
      synthesisId: 'syn-1',
      linkedInvestigations: [linked({ id: 'run-1' })],
      conflicts: [],
      materialized: false
    });

    expect(status.readinessState).toBe('incomplete');
    expect(status.blockingReasons).toContain('insufficient_completed_investigations');
  });

  it('T-SYN-ST4 classifies inconclusive when unresolved conflicts are present', () => {
    const status = evaluateSynthesisStatus({
      synthesisId: 'syn-1',
      linkedInvestigations: [linked({ id: 'run-1' }), linked({ id: 'run-2', findings: ['protocol_risk:aave:low'] })],
      conflicts: [conflict()],
      materialized: false
    });

    expect(status.readinessState).toBe('inconclusive');
    expect(status.unresolvedConflictCount).toBe(1);
  });

  it('T-SYN-ST5 classifies ready when complete reinforcement exists and no conflicts', () => {
    const status = evaluateSynthesisStatus({
      synthesisId: 'syn-1',
      linkedInvestigations: [linked({ id: 'run-1' }), linked({ id: 'run-2' })],
      conflicts: [],
      materialized: false
    });

    expect(status.readinessState).toBe('ready');
    expect(status.strengths).toContain('cross-investigation reinforcement present');
  });

  it('T-SYN-ST6 classifies completed when materialized finalization exists', () => {
    const status = evaluateSynthesisStatus({
      synthesisId: 'syn-1',
      linkedInvestigations: [linked({ id: 'run-1' }), linked({ id: 'run-2' })],
      conflicts: [],
      materialized: true
    });

    expect(status.readinessState).toBe('completed');
  });
});
