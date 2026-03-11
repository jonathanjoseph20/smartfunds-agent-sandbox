import { describe, expect, it } from 'vitest';

import { createMarketSynthesisStatusProjection } from './market-synthesis-status.ts';

describe('market-synthesis status projection', () => {
  it('T-MS-S1 classifies blocked readiness when blockers/conflicts are present', () => {
    const projection = createMarketSynthesisStatusProjection({
      registry: {
        listDefinitions: () => [{
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          enabled: true,
          crossSwarmMatchingRules: {},
          scopeConstraints: { minCrossSwarms: 1 }
        }],
        getDefinition: () => ({
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          enabled: true,
          crossSwarmMatchingRules: {},
          scopeConstraints: { minCrossSwarms: 1 }
        })
      } as any,
      linker: {
        buildLinks: () => [{
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          enabled: true,
          linkedCrossSwarmIds: ['a'],
          linkedCrossSwarms: [{
            crossSwarmId: 'a',
            displayName: 'A',
            groupType: 'market_shock_cluster',
            lifecycleState: 'stabilizing',
            readinessState: 'blocked',
            completionSatisfied: false,
            unresolvedConflictCount: 2,
            blockers: ['incomplete_swarm:a'],
            conflicts: ['swarm_conflicts:a:2'],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: [],
            responseFamilies: []
          }],
          rationale: []
        }]
      } as any
    });

    const status = projection.projectOne('market-risk-synthesis');
    expect(status.readinessState).toBe('blocked');
    expect(status.completionState).toBe('inconclusive');
  });

  it('T-MS-S2 classifies coherent and completed only with complete coherent coverage', () => {
    const projection = createMarketSynthesisStatusProjection({
      registry: {
        listDefinitions: () => [{
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          enabled: true,
          crossSwarmMatchingRules: {},
          scopeConstraints: { minCrossSwarms: 2 }
        }],
        getDefinition: () => ({
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          enabled: true,
          crossSwarmMatchingRules: {},
          scopeConstraints: { minCrossSwarms: 2 }
        })
      } as any,
      linker: {
        buildLinks: () => [{
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          enabled: true,
          linkedCrossSwarmIds: ['a', 'b'],
          linkedCrossSwarms: [{
            crossSwarmId: 'a',
            displayName: 'A',
            groupType: 'market_shock_cluster',
            lifecycleState: 'completed',
            readinessState: 'coherent',
            completionSatisfied: true,
            unresolvedConflictCount: 0,
            blockers: [],
            conflicts: [],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: [],
            responseFamilies: []
          }, {
            crossSwarmId: 'b',
            displayName: 'B',
            groupType: 'protocol_response_cluster',
            lifecycleState: 'completed',
            readinessState: 'coherent',
            completionSatisfied: true,
            unresolvedConflictCount: 0,
            blockers: [],
            conflicts: [],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: [],
            responseFamilies: []
          }],
          rationale: []
        }]
      } as any
    });

    const status = projection.projectOne('market-risk-synthesis');
    expect(status.readinessState).toBe('coherent');
    expect(status.completionState).toBe('completed');
  });

  it('T-MS-S3 classifies inconclusive when coverage is weak', () => {
    const projection = createMarketSynthesisStatusProjection({
      registry: {
        listDefinitions: () => [{
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          enabled: true,
          crossSwarmMatchingRules: {},
          scopeConstraints: { minCrossSwarms: 2 }
        }],
        getDefinition: () => ({
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          enabled: true,
          crossSwarmMatchingRules: {},
          scopeConstraints: { minCrossSwarms: 2 }
        })
      } as any,
      linker: {
        buildLinks: () => [{
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          enabled: true,
          linkedCrossSwarmIds: ['a'],
          linkedCrossSwarms: [{
            crossSwarmId: 'a',
            displayName: 'A',
            groupType: 'market_shock_cluster',
            lifecycleState: 'completed',
            readinessState: 'coherent',
            completionSatisfied: true,
            unresolvedConflictCount: 0,
            blockers: [],
            conflicts: [],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: [],
            responseFamilies: []
          }],
          rationale: []
        }]
      } as any
    });

    const status = projection.projectOne('market-risk-synthesis');
    expect(status.completionState).toBe('inconclusive');
    expect(status.blockingReasons).toContain('weak_coverage:min_required:2:linked:1');
  });
});
