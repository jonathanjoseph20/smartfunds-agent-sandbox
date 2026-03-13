import { describe, expect, it } from 'vitest';

import {
  createMissionPortfolioStatePropagation,
  deriveMissionPortfolioStatePropagationClass,
} from '../../mission-control/mission-portfolio-state-propagation.ts';

describe('mission portfolio state propagation', () => {
  it('T-ROP-P1 covers each mission portfolio propagation class', () => {
    expect(deriveMissionPortfolioStatePropagationClass({ runtimeStatus: 'runtime_completed', healthState: 'healthy', readinessState: 'ready' })).toBe('portfolio_stabilization_improved');
    expect(deriveMissionPortfolioStatePropagationClass({ runtimeStatus: 'runtime_completed', healthState: 'degraded', readinessState: 'ready' })).toBe('portfolio_attention_cleared');
    expect(deriveMissionPortfolioStatePropagationClass({ runtimeStatus: 'runtime_completed', healthState: 'degraded', readinessState: 'blocked' })).toBe('portfolio_resolution_advanced');
    expect(deriveMissionPortfolioStatePropagationClass({ runtimeStatus: 'runtime_failed', healthState: 'unhealthy', readinessState: 'blocked' })).toBe('portfolio_stabilization_regressed');
    expect(deriveMissionPortfolioStatePropagationClass({ runtimeStatus: 'runtime_failed', healthState: 'degraded', readinessState: 'blocked' })).toBe('portfolio_resolution_blocked');
    expect(deriveMissionPortfolioStatePropagationClass({ runtimeStatus: 'runtime_deferred', healthState: 'degraded', readinessState: 'blocked' })).toBe('portfolio_closure_eligibility_changed');
  });

  it('T-ROP-P2 deterministic creation', () => {
    const one = createMissionPortfolioStatePropagation({
      runtimeOutcomePropagationRecordId: 'record-1',
      missionPortfolioId: 'portfolio-1',
      runtimeStatus: 'runtime_completed',
      healthState: 'healthy',
      readinessState: 'ready',
      reasonTokens: ['b', 'a'],
    });

    const two = createMissionPortfolioStatePropagation({
      runtimeOutcomePropagationRecordId: 'record-1',
      missionPortfolioId: 'portfolio-1',
      runtimeStatus: 'runtime_completed',
      healthState: 'healthy',
      readinessState: 'ready',
      reasonTokens: ['a', 'b'],
    });

    expect(one).toEqual(two);
  });
});
