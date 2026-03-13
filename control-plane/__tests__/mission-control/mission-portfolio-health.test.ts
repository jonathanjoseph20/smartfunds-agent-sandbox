import { describe, expect, it } from 'vitest';

import { deriveMissionPortfolioHealthState } from '../../mission-control/mission-portfolio-health.ts';

function signal(overrides: Partial<Parameters<typeof deriveMissionPortfolioHealthState>[0]['signals'][number]> = {}) {
  return {
    missionRunId: 'run-1',
    operationalState: 'active',
    completionState: 'in_progress',
    healthState: 'unstable',
    ...overrides,
  };
}

describe('mission portfolio health', () => {
  it('T-MP-H1 derives failed for repeated failed missions', () => {
    expect(deriveMissionPortfolioHealthState({
      signals: [
        signal({ missionRunId: 'run-1', completionState: 'failed', healthState: 'failed' }),
        signal({ missionRunId: 'run-2', completionState: 'failed', healthState: 'failed' }),
      ],
      blockingClusterCount: 0,
    })).toBe('failed');
  });

  it('T-MP-H2 derives blocked when blocking clusters exist', () => {
    expect(deriveMissionPortfolioHealthState({
      signals: [signal()],
      blockingClusterCount: 1,
    })).toBe('blocked');
  });

  it('T-MP-H3 derives unstable on mixed unstable states', () => {
    expect(deriveMissionPortfolioHealthState({
      signals: [
        signal({ missionRunId: 'run-1', healthState: 'unstable' }),
        signal({ missionRunId: 'run-2', healthState: 'unstable' }),
        signal({ missionRunId: 'run-3', healthState: 'healthy', completionState: 'completed', operationalState: 'completed' }),
      ],
      blockingClusterCount: 0,
    })).toBe('unstable');
  });

  it('T-MP-H4 derives degraded for minor issues', () => {
    expect(deriveMissionPortfolioHealthState({
      signals: [
        signal({ missionRunId: 'run-1', healthState: 'degraded', operationalState: 'degraded' }),
        signal({ missionRunId: 'run-2', healthState: 'healthy', completionState: 'completed', operationalState: 'completed' }),
      ],
      blockingClusterCount: 0,
    })).toBe('degraded');
  });

  it('T-MP-H5 derives healthy when all are healthy', () => {
    expect(deriveMissionPortfolioHealthState({
      signals: [
        signal({ missionRunId: 'run-1', healthState: 'healthy', completionState: 'completed', operationalState: 'completed' }),
      ],
      blockingClusterCount: 0,
    })).toBe('healthy');
  });

  it('T-MP-H6 derives inconclusive when no signals are present', () => {
    expect(deriveMissionPortfolioHealthState({
      signals: [],
      blockingClusterCount: 0,
    })).toBe('inconclusive');
  });
});
