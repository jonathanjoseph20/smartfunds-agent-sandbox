import { describe, expect, it } from 'vitest';

import { deriveMissionPortfolioReadinessState } from '../../mission-control/mission-portfolio-readiness.ts';

function signal(overrides: Partial<Parameters<typeof deriveMissionPortfolioReadinessState>[0]['signals'][number]> = {}) {
  return {
    missionRunId: 'run-1',
    priority: 'normal',
    operationalState: 'active',
    completionState: 'in_progress',
    healthState: 'unstable',
    coordinationState: 'active',
    governanceStatus: 'approved',
    hasBlockingDependencies: false,
    ...overrides,
  };
}

describe('mission portfolio readiness', () => {
  it('T-MP-R1 derives blocked for critical mission blockers', () => {
    expect(deriveMissionPortfolioReadinessState({
      signals: [signal({ priority: 'critical', coordinationState: 'blocked_by_dependency' })],
    })).toBe('blocked');
  });

  it('T-MP-R2 derives ready when majority are ready', () => {
    expect(deriveMissionPortfolioReadinessState({
      signals: [
        signal({ missionRunId: 'run-1', coordinationState: 'active' }),
        signal({ missionRunId: 'run-2', coordinationState: 'ready_to_resume' }),
        signal({ missionRunId: 'run-3', coordinationState: 'completed', completionState: 'completed' }),
      ],
    })).toBe('ready');
  });

  it('T-MP-R3 derives partially_ready on mixed posture', () => {
    expect(deriveMissionPortfolioReadinessState({
      signals: [
        signal({ missionRunId: 'run-1', coordinationState: 'active' }),
        signal({ missionRunId: 'run-2', coordinationState: 'awaiting_start', governanceStatus: 'awaiting_review' }),
      ],
    })).toBe('partially_ready');
  });

  it('T-MP-R4 derives degraded when major degraded signals present', () => {
    expect(deriveMissionPortfolioReadinessState({
      signals: [
        signal({ missionRunId: 'run-1', healthState: 'degraded', operationalState: 'degraded' }),
        signal({ missionRunId: 'run-2', healthState: 'degraded', operationalState: 'degraded' }),
        signal({ missionRunId: 'run-3', healthState: 'unstable', operationalState: 'active' }),
      ],
    })).toBe('degraded');
  });

  it('T-MP-R5 derives inconclusive when insufficient information exists', () => {
    expect(deriveMissionPortfolioReadinessState({
      signals: [
        signal({ missionRunId: 'run-1', operationalState: 'inconclusive', healthState: 'inconclusive', governanceStatus: 'inconclusive' }),
      ],
    })).toBe('inconclusive');
  });

  it('T-MP-R6 derives not_ready when no mission is ready', () => {
    expect(deriveMissionPortfolioReadinessState({
      signals: [
        signal({ missionRunId: 'run-1', coordinationState: 'awaiting_start', governanceStatus: 'deferred', operationalState: 'pending', healthState: 'unstable' }),
      ],
    })).toBe('not_ready');
  });
});
