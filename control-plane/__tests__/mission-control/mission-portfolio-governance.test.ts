import { describe, expect, it } from 'vitest';

import { deriveMissionPortfolioGovernancePosture } from '../../mission-control/mission-portfolio-governance.ts';

function signal(overrides: Partial<Parameters<typeof deriveMissionPortfolioGovernancePosture>[0]['signals'][number]> = {}) {
  return {
    missionRunId: 'run-1',
    governanceStatus: 'approved',
    decisionOutcome: 'approved',
    ...overrides,
  };
}

describe('mission portfolio governance', () => {
  it('T-MP-G1 derives decision_blocked when any mission is rejected', () => {
    expect(deriveMissionPortfolioGovernancePosture({
      signals: [signal({ governanceStatus: 'rejected', decisionOutcome: 'rejected' })],
    })).toBe('decision_blocked');
  });

  it('T-MP-G2 derives awaiting_reviews when queue is pending', () => {
    expect(deriveMissionPortfolioGovernancePosture({
      signals: [signal({ governanceStatus: 'awaiting_review', decisionOutcome: 'pending' })],
    })).toBe('awaiting_reviews');
  });

  it('T-MP-G3 derives deferred when all missions are deferred', () => {
    expect(deriveMissionPortfolioGovernancePosture({
      signals: [signal({ governanceStatus: 'deferred', decisionOutcome: 'deferred' })],
    })).toBe('deferred');
  });

  it('T-MP-G4 derives clear when all missions are approved/no_review_required', () => {
    expect(deriveMissionPortfolioGovernancePosture({
      signals: [
        signal({ missionRunId: 'run-1', governanceStatus: 'approved' }),
        signal({ missionRunId: 'run-2', governanceStatus: 'no_review_required', decisionOutcome: 'pending' }),
      ],
    })).toBe('clear');
  });

  it('T-MP-G5 derives mixed for mixed outcomes', () => {
    expect(deriveMissionPortfolioGovernancePosture({
      signals: [
        signal({ missionRunId: 'run-1', governanceStatus: 'approved' }),
        signal({ missionRunId: 'run-2', governanceStatus: 'deferred', decisionOutcome: 'deferred' }),
      ],
    })).toBe('mixed');
  });

  it('T-MP-G6 derives inconclusive when input is empty', () => {
    expect(deriveMissionPortfolioGovernancePosture({ signals: [] })).toBe('inconclusive');
  });
});
