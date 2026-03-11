import { describe, expect, it } from 'vitest';

import { createCrossSwarmLinker } from './cross-swarm-linker.ts';

describe('cross-swarm linker', () => {
  it('T-CS-L1 groups related swarms deterministically with explicit rationale', () => {
    const registry = {
      listDefinitions: () => [{
        crossSwarmId: 'protocol-response-cluster',
        displayName: 'Protocol Response Cluster',
        groupType: 'protocol_response_cluster',
        enabled: true,
        scope: { teamIds: ['defi-risk-team'], subjectKeys: ['aave'] },
        include: {
          swarmIds: ['protocol-risk-response'],
          teamIds: ['defi-risk-team'],
          protocolFamilies: ['aave'],
          assetFamilies: [],
          eventFamilies: ['protocol'],
          cohortFamilies: ['protocol']
        },
        requiredMatchDimensions: ['explicit_definition_match', 'shared_team_ownership', 'shared_event_family', 'shared_cohort_family'],
        completionRules: {
          requireAllLinkedSwarmsComplete: true,
          requireNoBlockedSwarms: true,
          requireNoUnresolvedConflicts: true,
          requireCoherentReadiness: true
        }
      }],
      getDefinition: () => { throw new Error('unused'); }
    } as any;

    const swarmRegistry = {
      listSwarmDefinitions: () => [{
        swarmId: 'protocol-risk-response',
        displayName: 'Protocol Risk Response Swarm',
        teamId: 'defi-risk-team',
        investigationTemplates: ['protocol-risk-investigation']
      }, {
        swarmId: 'yield-instability-response',
        displayName: 'Yield Instability Response Swarm',
        teamId: 'yield-anomaly-team',
        investigationTemplates: ['yield-anomaly-investigation']
      }]
    } as any;

    const swarmInspection = {
      inspectSwarm: (swarmId: string) => {
        if (swarmId === 'protocol-risk-response') {
          return {
            swarmId,
            state: 'progressing',
            readiness: { readiness: 'analyzing' },
            completion: { isComplete: false, unresolvedConflictCount: 0 },
            investigations: [{ investigationRunId: 'inv-1', investigationDefinitionId: 'protocol-risk-investigation', status: 'running' }],
            syntheses: [{ synthesisId: 'syn-1' }]
          };
        }

        return {
          swarmId,
          state: 'inactive',
          readiness: { readiness: 'pending' },
          completion: { isComplete: false, unresolvedConflictCount: 0 },
          investigations: [],
          syntheses: []
        };
      }
    } as any;

    const attachmentResolver = {
      resolveAttachmentsForTeam: (teamId: string) => teamId === 'defi-risk-team'
        ? [{ teamId, cohortId: 'aave-risk', attachmentReason: ['cohort_type_match:protocol-risk'] }]
        : []
    } as any;

    const cohortRegistry = {
      getCohortDefinition: (cohortId: string) => ({
        cohortId,
        cohortType: 'protocol-risk',
        subjectKey: 'aave',
        linkRules: {
          sharedProtocol: true,
          sharedAsset: false,
          sharedEventFamily: false,
          sharedTriggerFamily: false,
          cohortDefinitionMatch: true
        }
      })
    } as any;

    const investigationInspection = {
      inspectInvestigation: () => ({
        record: {
          sourceSignalType: 'protocol_risk',
          sourceSignalReference: 'signal-1'
        }
      })
    } as any;

    const signalStore = {
      getSignalByDedupeKey: () => ({ metadata: { protocol: 'Aave' } })
    } as any;

    const linker = createCrossSwarmLinker({
      registry,
      swarmRegistry,
      swarmInspection,
      attachmentResolver,
      cohortRegistry,
      investigationInspection,
      signalStore
    });

    const links = linker.buildLinks();
    expect(links[0]?.linkedSwarmIds).toEqual(['protocol-risk-response']);
    expect(links[0]?.linkedSwarms[0]?.rationale.map((entry) => entry.dimension)).toEqual([
      'explicit_definition_match',
      'shared_cohort_family',
      'shared_event_family',
      'shared_team_ownership'
    ]);
  });

  it('T-CS-L2 does not link unrelated swarms', () => {
    const registry = {
      listDefinitions: () => [{
        crossSwarmId: 'governance-risk-cluster',
        displayName: 'Governance Risk Cluster',
        groupType: 'governance_risk_cluster',
        enabled: true,
        scope: { teamIds: ['governance-monitoring-team'], subjectKeys: ['aave'] },
        include: {
          swarmIds: ['governance-anomaly-response'],
          teamIds: ['governance-monitoring-team'],
          protocolFamilies: ['aave'],
          assetFamilies: [],
          eventFamilies: ['governance'],
          cohortFamilies: ['governance']
        },
        requiredMatchDimensions: ['explicit_definition_match', 'shared_event_family'],
        completionRules: {
          requireAllLinkedSwarmsComplete: true,
          requireNoBlockedSwarms: true,
          requireNoUnresolvedConflicts: true,
          requireCoherentReadiness: true
        }
      }],
      getDefinition: () => { throw new Error('unused'); }
    } as any;

    const swarmRegistry = {
      listSwarmDefinitions: () => [{
        swarmId: 'liquidity-shock-response',
        displayName: 'Liquidity Shock Response',
        teamId: 'liquidity-response-team',
        investigationTemplates: ['liquidity-drain-investigation']
      }]
    } as any;

    const linker = createCrossSwarmLinker({
      registry,
      swarmRegistry,
      swarmInspection: {
        inspectSwarm: () => ({
          state: 'active',
          readiness: { readiness: 'analyzing' },
          completion: { isComplete: false, unresolvedConflictCount: 0 },
          investigations: [],
          syntheses: []
        })
      } as any,
      attachmentResolver: {
        resolveAttachmentsForTeam: () => []
      } as any,
      cohortRegistry: {
        getCohortDefinition: () => ({ cohortType: 'liquidity-monitoring', subjectKey: 'aave' })
      } as any,
      investigationInspection: {
        inspectInvestigation: () => ({ record: { sourceSignalType: 'liquidity_shock', sourceSignalReference: 'none' } })
      } as any,
      signalStore: {
        getSignalByDedupeKey: () => null
      } as any
    });

    const links = linker.buildLinks();
    expect(links[0]?.linkedSwarmIds).toEqual([]);
  });
});
