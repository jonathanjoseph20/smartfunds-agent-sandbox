import { describe, expect, it } from 'vitest';

import { evaluateSwarmReadiness } from './swarm-readiness.ts';

describe('swarm readiness evaluation', () => {
  it('T-SW-RD1 returns blocked when unresolved conflicts exist', () => {
    const readiness = evaluateSwarmReadiness({
      swarmId: 'protocol-risk-response',
      expectedInvestigationTemplates: ['protocol-risk-investigation'],
      investigations: [{ investigationDefinitionId: 'protocol-risk-investigation', status: 'running' }],
      synthesisReadinessStates: ['ready'],
      unresolvedConflictCount: 2
    });

    expect(readiness.readiness).toBe('blocked');
    expect(readiness.blockingReasons).toContain('unresolved_conflicts_present');
  });

  it('T-SW-RD2 returns coherent when synthesis is ready and coverage is complete', () => {
    const readiness = evaluateSwarmReadiness({
      swarmId: 'liquidity-shock-response',
      expectedInvestigationTemplates: ['liquidity-drain-investigation'],
      investigations: [{ investigationDefinitionId: 'liquidity-drain-investigation', status: 'completed' }],
      synthesisReadinessStates: ['ready'],
      unresolvedConflictCount: 0
    });

    expect(readiness.readiness).toBe('coherent');
  });

  it('T-SW-RD3 returns pending or analyzing deterministically', () => {
    expect(evaluateSwarmReadiness({
      swarmId: 'yield-instability-response',
      expectedInvestigationTemplates: ['yield-anomaly-investigation'],
      investigations: [],
      synthesisReadinessStates: [],
      unresolvedConflictCount: 0
    }).readiness).toBe('pending');

    expect(evaluateSwarmReadiness({
      swarmId: 'yield-instability-response',
      expectedInvestigationTemplates: ['yield-anomaly-investigation'],
      investigations: [{ investigationDefinitionId: 'yield-anomaly-investigation', status: 'running' }],
      synthesisReadinessStates: [],
      unresolvedConflictCount: 0
    }).readiness).toBe('analyzing');
  });
});
