import { describe, expect, it } from 'vitest';

import { evaluateInvestigationCompletion } from './completion-evaluator.ts';
import type { CompletionConfidenceMetrics, CompletionEvidenceMetrics, CompletionLifecycleSnapshot } from './completion-types.ts';
import type { InvestigationDelta } from './revision-types.ts';

function baseline(overrides: {
  convergenceState?: 'converging' | 'stable' | 'still_evolving' | 'diverging' | 'inconclusive';
  healthState?: 'healthy' | 'waiting_normally' | 'retrying' | 'blocked_by_missing_evidence' | 'degraded_by_counter_evidence' | 'stalled' | 'inconclusive';
  lifecycle?: CompletionLifecycleSnapshot;
  confidence?: CompletionConfidenceMetrics;
  evidence?: CompletionEvidenceMetrics;
  latestDelta?: InvestigationDelta;
} = {}) {
  return {
    convergenceState: overrides.convergenceState ?? 'stable',
    healthState: overrides.healthState ?? 'healthy',
    lifecycle: overrides.lifecycle ?? {
      status: 'running',
      completedPhaseIds: ['intake', 'gather', 'analyze', 'synthesize', 'finalize']
    },
    confidence: overrides.confidence ?? {
      reportConfidenceBand: 'high',
      reportConfidenceScore: 80,
      trend: 'flat'
    },
    evidence: overrides.evidence ?? {
      supportingEvidenceCount: 3,
      counterEvidenceCount: 0,
      unresolvedGapCount: 0,
      unresolvedCriticalGapCount: 0
    },
    criteria: {
      requiredPhaseIds: ['intake', 'gather', 'analyze', 'synthesize', 'finalize'],
      minimumConfidenceBand: 'medium' as const,
      requireNoCriticalGaps: true,
      requireConvergenceState: 'converging' as const,
      minimumSupportingEvidenceCount: 2
    },
    latestDelta: overrides.latestDelta
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

describe('completion evaluator', () => {
  it('T-INV-CMP1 classifies ready_to_finalize when all criteria pass and convergence is stable', () => {
    const result = evaluateInvestigationCompletion(baseline({ convergenceState: 'stable' }));
    expect(result.readinessState).toBe('ready_to_finalize');
    expect(result.blockingReasons).toEqual([]);
  });

  it('T-INV-CMP2 classifies blocked when required phases are incomplete', () => {
    const result = evaluateInvestigationCompletion(baseline({
      lifecycle: { status: 'running', completedPhaseIds: ['intake', 'gather'] }
    }));
    expect(result.readinessState).toBe('blocked');
    expect(result.blockingReasons).toContain('required_phase_incomplete');
  });

  it('T-INV-CMP3 classifies still_evolving when convergence is still_evolving', () => {
    const result = evaluateInvestigationCompletion(baseline({ convergenceState: 'still_evolving' }));
    expect(result.readinessState).toBe('still_evolving');
  });

  it('T-INV-CMP4 classifies inconclusive when convergence or health is inconclusive', () => {
    const result = evaluateInvestigationCompletion(baseline({ convergenceState: 'inconclusive' }));
    expect(result.readinessState).toBe('inconclusive');
  });

  it('T-INV-CMP5 classifies complete when lifecycle is completed and criteria hold', () => {
    const result = evaluateInvestigationCompletion(baseline({
      lifecycle: {
        status: 'completed',
        completedPhaseIds: ['intake', 'gather', 'analyze', 'synthesize', 'finalize']
      }
    }));
    expect(result.readinessState).toBe('complete');
  });

  it('T-INV-CMP6 classifies unhealthy when health indicates stalled or degraded', () => {
    const stalled = evaluateInvestigationCompletion(baseline({ healthState: 'stalled' }));
    const degraded = evaluateInvestigationCompletion(baseline({
      healthState: 'degraded_by_counter_evidence',
      latestDelta: delta('counter_evidence_added')
    }));
    expect(stalled.readinessState).toBe('unhealthy');
    expect(degraded.readinessState).toBe('unhealthy');
    expect(degraded.blockingReasons).toContain('recent_counter_evidence_added');
  });
});

