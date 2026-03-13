import { describe, expect, it } from 'vitest';

import { deriveMissionPortfolioMembershipId } from '../../mission-control/mission-portfolio-identity.ts';
import {
  deriveMissionPortfolioMembership,
  summarizeMissionPortfolioMembership,
} from '../../mission-control/mission-portfolio-membership.ts';

describe('mission portfolio membership', () => {
  it('T-MP-M1 deterministic membership identity remains stable', () => {
    const first = deriveMissionPortfolioMembershipId({
      missionPortfolioId: 'portfolio-1',
      missionRunId: 'run-1',
      membershipClass: 'shared_objective',
      reasonTokens: ['b', 'a'],
      state: 'active',
    });

    const second = deriveMissionPortfolioMembershipId({
      missionPortfolioId: 'portfolio-1',
      missionRunId: 'run-1',
      membershipClass: 'shared_objective',
      reasonTokens: ['a', 'b'],
      state: 'active',
    });

    expect(second).toBe(first);
  });

  it('T-MP-M2 membership ordering is deterministic', () => {
    const memberships = deriveMissionPortfolioMembership({
      portfolio: {
        missionPortfolioId: 'portfolio-1',
        displayName: 'x',
        portfolioType: 'coordination_portfolio',
      },
      missionRunIds: ['run-2', 'run-1', 'run-3'],
      missionPriorities: new Map([
        ['run-1', 'high'],
        ['run-2', 'low'],
        ['run-3', 'critical'],
      ]),
      blockedMissionRunIds: new Set(['run-3']),
      governanceImpactedMissionRunIds: new Set(),
    });

    expect(memberships.map((entry) => entry.missionRunId)).toEqual(['run-1', 'run-2', 'run-3']);
  });

  it('T-MP-M3 duplicate inputs dedupe identical memberships', () => {
    const memberships = deriveMissionPortfolioMembership({
      portfolio: {
        missionPortfolioId: 'portfolio-1',
        displayName: 'x',
        portfolioType: 'objective_portfolio',
      },
      missionRunIds: ['run-1', 'run-1', 'run-2'],
      missionPriorities: new Map(),
      blockedMissionRunIds: new Set(),
      governanceImpactedMissionRunIds: new Set(),
    });

    expect(memberships.map((entry) => entry.missionRunId)).toEqual(['run-1', 'run-2']);

    const summary = summarizeMissionPortfolioMembership({ memberships });
    expect(summary.totalMembershipCount).toBe(2);
    expect(summary.activeMembershipCount).toBe(2);
  });
});
