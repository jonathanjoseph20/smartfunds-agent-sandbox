import { describe, expect, it } from 'vitest';

import { classifyCohortHealth } from './cohort-health.ts';

describe('cohort health', () => {
  it('T-COH-H1 classifies conflicted for contradictory synthesis states', () => {
    const health = classifyCohortHealth({
      investigationReadinessStates: ['complete', 'complete'],
      synthesisReadinessStates: ['inconclusive'],
      synthesisConflictCount: 2,
      restartCount: 0
    });

    expect(health.healthState).toBe('conflicted');
  });

  it('T-COH-H2 classifies unstable for repeated investigation restarts', () => {
    const health = classifyCohortHealth({
      investigationReadinessStates: ['complete'],
      synthesisReadinessStates: ['ready'],
      synthesisConflictCount: 0,
      restartCount: 2
    });

    expect(health.healthState).toBe('unstable');
  });
});
