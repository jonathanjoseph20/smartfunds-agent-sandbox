import { describe, expect, it } from 'vitest';

import { createMarketSynthesisLinker } from './market-synthesis-linker.ts';

describe('market-synthesis linker', () => {
  it('T-MS-L1 groups related cross-swarms via deterministic shared families and explicit rationale', () => {
    const linker = createMarketSynthesisLinker({
      registry: {
        listDefinitions: () => [{
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          enabled: true,
          crossSwarmMatchingRules: {
            eventFamilies: ['market'],
            responseFamilies: ['market']
          },
          scopeConstraints: { minCrossSwarms: 1 }
        }],
        getDefinition: () => { throw new Error('unused'); }
      } as any,
      crossSwarmInspection: {
        listCrossSwarms: () => [{ crossSwarmId: 'market-shock-cluster', displayName: 'Market Shock', groupType: 'market_shock_cluster', enabled: true }],
        inspectCrossSwarm: () => ({
          crossSwarmId: 'market-shock-cluster',
          displayName: 'Market Shock',
          groupType: 'market_shock_cluster',
          enabled: true,
          linkedSwarmIds: ['a'],
          linkedSwarms: [{
            crossSwarmId: 'market-shock-cluster',
            swarmId: 'a',
            teamId: 'team-a',
            swarmDisplayName: 'A',
            lifecycleState: 'progressing',
            readinessState: 'analyzing',
            completionSatisfied: false,
            unresolvedConflictCount: 0,
            activeInvestigationCount: 1,
            linkedInvestigationIds: ['inv-1'],
            linkedSynthesisIds: [],
            protocolFamilies: ['aave'],
            assetFamilies: [],
            eventFamilies: ['market'],
            cohortFamilies: ['market'],
            rationale: []
          }],
          lifecycleState: 'progressing',
          readinessState: 'analyzing',
          completion: {
            crossSwarmId: 'market-shock-cluster',
            isComplete: false,
            unmetRequirements: [],
            completedSwarmCount: 0,
            totalSwarmCount: 1,
            blockedSwarmCount: 0,
            unresolvedConflictCount: 0
          },
          blockers: [],
          conflicts: [],
          strengths: [],
          limitations: [],
          rationale: [],
          historySummary: { totalEvents: 0 },
          artifactPaths: { dirPath: '', statusJsonPath: '', historyJsonPath: '', reportJsonPath: '', reportMarkdownPath: '' },
          statusPreview: {},
          reportPreview: {}
        })
      } as any
    });

    const links = linker.buildLinks();

    expect(links[0]?.linkedCrossSwarmIds).toEqual(['market-shock-cluster']);
    expect(links[0]?.rationale).toContain('market-shock-cluster:shared_event_family:market');
    expect(links[0]?.rationale).toContain('market-shock-cluster:shared_response_family:market');
  });

  it('T-MS-L2 excludes unrelated cross-swarms', () => {
    const linker = createMarketSynthesisLinker({
      registry: {
        listDefinitions: () => [{
          marketSynthesisId: 'governance-instability-market-synthesis',
          displayName: 'Governance Instability',
          synthesisType: 'governance_instability',
          enabled: true,
          crossSwarmMatchingRules: {
            eventFamilies: ['governance']
          },
          scopeConstraints: { minCrossSwarms: 1 }
        }],
        getDefinition: () => { throw new Error('unused'); }
      } as any,
      crossSwarmInspection: {
        listCrossSwarms: () => [{ crossSwarmId: 'liquidity-instability-cluster', displayName: 'Liquidity', groupType: 'liquidity_instability_cluster', enabled: true }],
        inspectCrossSwarm: () => ({
          crossSwarmId: 'liquidity-instability-cluster',
          displayName: 'Liquidity',
          groupType: 'liquidity_instability_cluster',
          enabled: true,
          linkedSwarmIds: [],
          linkedSwarms: [],
          lifecycleState: 'active',
          readinessState: 'analyzing',
          completion: {
            crossSwarmId: 'liquidity-instability-cluster',
            isComplete: false,
            unmetRequirements: [],
            completedSwarmCount: 0,
            totalSwarmCount: 0,
            blockedSwarmCount: 0,
            unresolvedConflictCount: 0
          },
          blockers: [],
          conflicts: [],
          strengths: [],
          limitations: [],
          rationale: [],
          historySummary: { totalEvents: 0 },
          artifactPaths: { dirPath: '', statusJsonPath: '', historyJsonPath: '', reportJsonPath: '', reportMarkdownPath: '' },
          statusPreview: {},
          reportPreview: {}
        })
      } as any
    });

    const links = linker.buildLinks();
    expect(links[0]?.linkedCrossSwarmIds).toEqual([]);
  });
});
