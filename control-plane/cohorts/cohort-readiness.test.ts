import { describe, expect, it } from 'vitest';

import { evaluateCohortReadiness } from './cohort-readiness.ts';

describe('cohort readiness', () => {
  it('T-COH-R1 classifies incomplete when investigations are partially complete', () => {
    const status = evaluateCohortReadiness({
      linkedInvestigationIds: ['run-1', 'run-2'],
      linkedSynthesisIds: ['syn-1'],
      investigationStatuses: ['completed', 'completed'],
      investigationReadinessStates: ['complete', 'still_evolving'],
      synthesisReadinessStates: ['active'],
      synthesisConflictCount: 0,
      limitations: [],
      materialized: false
    });

    expect(status.readinessState).toBe('incomplete');
  });

  it('T-COH-R2 classifies inconclusive when synthesis conflict exists', () => {
    const status = evaluateCohortReadiness({
      linkedInvestigationIds: ['run-1'],
      linkedSynthesisIds: ['syn-1'],
      investigationStatuses: ['completed'],
      investigationReadinessStates: ['complete'],
      synthesisReadinessStates: ['inconclusive'],
      synthesisConflictCount: 1,
      limitations: [],
      materialized: false
    });

    expect(status.readinessState).toBe('inconclusive');
  });

  it('T-COH-R3 classifies completed only from completed synthesis state, not artifacts', () => {
    const status = evaluateCohortReadiness({
      linkedInvestigationIds: ['run-1'],
      linkedSynthesisIds: ['syn-1'],
      investigationStatuses: ['completed'],
      investigationReadinessStates: ['complete'],
      synthesisReadinessStates: ['completed'],
      synthesisConflictCount: 0,
      limitations: []
    });

    expect(status.readinessState).toBe('completed');
  });
});
