import { describe, expect, it } from 'vitest';

import { createMissionControlOrchestrationProjection } from '../../mission-control/mission-control-orchestration-projection.ts';

describe('mission control orchestration projection', () => {
  it('T-MCO-PR1 replay stability and deterministic priority derivation', () => {
    const projection = createMissionControlOrchestrationProjection({
      crossPortfolioProjection: {
        projectAll: () => [{
          crossPortfolioMissionIntelligenceSetId: 'set-1',
          displayName: 'Set 1',
          setType: 'systemic_blocking_set',
          portfolioIds: ['portfolio-b', 'portfolio-a'],
          membershipSummary: { totalPortfolioCount: 2, uniquePortfolioCount: 2 },
          sharedDependencies: [],
          systemicBlockingClusters: [{ systemicBlockingClusterId: 'cluster-1', severity: 'critical' }],
          escalationPatterns: [{ crossPortfolioEscalationPatternId: 'pattern-1', severity: 'high', patternClass: 'repeated_blocking_escalation' }],
          systemicRiskPosture: 'critical',
          readinessPosture: 'blocked',
          intelligenceOutcome: 'systemically_unstable',
          linkedPortfolioSummaries: [],
          statusPreview: {},
          reportPreview: {},
        }],
        projectOne: () => ({}) as never,
        listIntelligenceSets: () => [],
      } as never,
      attentionProjection: {
        projectOne: () => ({ attentionRequirements: [], escalations: [] }),
      } as never,
      resolutionProjection: {
        projectOne: () => ({ resolution: { linkedRequirementIds: [] } }),
      } as never,
      governanceProjection: {
        summarizeQueue: () => [],
      } as never,
    });

    const one = projection.projectAll();
    const two = projection.projectAll();

    expect(two).toEqual(one);
    expect(two[0]?.interventionPlan.priority).toBe('critical');
  });
});
