import { describe, expect, it } from 'vitest';

import { createMissionControlOrchestrationProjection } from '../../mission-control/mission-control-orchestration-projection.ts';

function crossPortfolioProjection() {
  const base = {
    crossPortfolioMissionIntelligenceSetId: 'set-1',
    displayName: 'Set 1',
    setType: 'systemic_blocking_set',
    portfolioIds: ['portfolio-a', 'portfolio-b'],
    membershipSummary: { totalPortfolioCount: 2, uniquePortfolioCount: 2 },
    sharedDependencies: [],
    systemicBlockingClusters: [],
    escalationPatterns: [],
    systemicRiskPosture: 'degraded',
    readinessPosture: 'partially_ready',
    intelligenceOutcome: 'watch',
    linkedPortfolioSummaries: [],
    statusPreview: {},
    reportPreview: {},
  } as const;

  return {
    projectAll: () => [base, { ...base }],
    projectOne: () => base,
    listIntelligenceSets: () => [],
  };
}

describe('mission control orchestration intervention plan', () => {
  it('T-MCO-P1 duplicate plan dedupe keeps one deterministic plan', () => {
    const projection = createMissionControlOrchestrationProjection({
      crossPortfolioProjection: crossPortfolioProjection() as never,
      attentionProjection: {
        projectOne: () => ({
          attentionRequirements: [],
          escalations: [],
        }),
      } as never,
      resolutionProjection: {
        projectOne: () => ({
          resolution: { linkedRequirementIds: [] },
        }),
      } as never,
      governanceProjection: {
        summarizeQueue: () => [],
      } as never,
    });

    expect(projection.listInterventionPlans()).toHaveLength(1);
  });
});
