import { describe, expect, it } from 'vitest';

import { deriveMissionPortfolioClosureEligibility } from '../../mission-control/mission-portfolio-closure-eligibility.ts';
import type {
  MissionPortfolioResolutionStatusRecord,
  MissionPortfolioStabilization,
} from '../../mission-control/mission-portfolio-resolution-types.ts';

function stabilization(status: MissionPortfolioStabilization['stabilizationStatus']): MissionPortfolioStabilization {
  return {
    portfolioStabilizationId: `stab-${status}`,
    missionPortfolioId: 'portfolio-1',
    stabilizationStatus: status,
    reasonTokens: [],
    linkedAttentionRequirementIds: [],
    linkedEscalationIds: [],
    linkedBlockingClusterIds: [],
    state: 'active',
  };
}

function resolution(status: MissionPortfolioResolutionStatusRecord['resolutionStatus']): MissionPortfolioResolutionStatusRecord {
  return {
    portfolioResolutionStatusId: `res-${status}`,
    missionPortfolioId: 'portfolio-1',
    resolutionStatus: status,
    reasonTokens: [],
    linkedActionRecordIds: [],
    linkedRequirementIds: [],
    state: 'active',
  };
}

describe('mission portfolio closure eligibility', () => {
  it('T-MPR-C1 derives blocked_from_closure', () => {
    const result = deriveMissionPortfolioClosureEligibility({
      missionPortfolioId: 'portfolio-1',
      stabilization: stabilization('not_stable'),
      resolution: resolution('unresolved'),
      unresolvedRequirementCount: 1,
      openEscalationCount: 1,
      blockingClusterCount: 1,
    });

    expect(result.closureEligibility).toBe('blocked_from_closure');
  });

  it('T-MPR-C2 derives not_closeable', () => {
    const result = deriveMissionPortfolioClosureEligibility({
      missionPortfolioId: 'portfolio-1',
      stabilization: stabilization('stabilizing'),
      resolution: resolution('partially_resolved'),
      unresolvedRequirementCount: 1,
      openEscalationCount: 0,
      blockingClusterCount: 0,
    });

    expect(result.closureEligibility).toBe('not_closeable');
  });

  it('T-MPR-C3 derives conditionally_closeable', () => {
    const result = deriveMissionPortfolioClosureEligibility({
      missionPortfolioId: 'portfolio-1',
      stabilization: stabilization('stabilizing'),
      resolution: resolution('partially_resolved'),
      unresolvedRequirementCount: 0,
      openEscalationCount: 0,
      blockingClusterCount: 0,
    });

    expect(result.closureEligibility).toBe('conditionally_closeable');
  });

  it('T-MPR-C4 derives closeable', () => {
    const result = deriveMissionPortfolioClosureEligibility({
      missionPortfolioId: 'portfolio-1',
      stabilization: stabilization('stable'),
      resolution: resolution('resolved'),
      unresolvedRequirementCount: 0,
      openEscalationCount: 0,
      blockingClusterCount: 0,
    });

    expect(result.closureEligibility).toBe('closeable');
  });

  it('T-MPR-C5 derives inconclusive', () => {
    const result = deriveMissionPortfolioClosureEligibility({
      missionPortfolioId: 'portfolio-1',
      stabilization: stabilization('inconclusive'),
      resolution: resolution('inconclusive'),
      unresolvedRequirementCount: 0,
      openEscalationCount: 0,
      blockingClusterCount: 0,
    });

    expect(result.closureEligibility).toBe('inconclusive');
  });
});
