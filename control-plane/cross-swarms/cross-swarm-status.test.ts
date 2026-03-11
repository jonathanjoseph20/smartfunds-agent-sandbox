import { describe, expect, it } from 'vitest';

import { createCrossSwarmStatusProjection } from './cross-swarm-status.ts';

describe('cross-swarm status projection', () => {
  it('T-CS-S1 classifies inactive state when no linked swarms', () => {
    const projection = createCrossSwarmStatusProjection({
      registry: {
        listDefinitions: () => [{
          crossSwarmId: 'x',
          displayName: 'X',
          groupType: 'market_shock_cluster',
          enabled: true,
          scope: { teamIds: [], subjectKeys: [] },
          include: { swarmIds: [], teamIds: [], protocolFamilies: [], assetFamilies: [], eventFamilies: [], cohortFamilies: [] },
          requiredMatchDimensions: ['explicit_definition_match'],
          completionRules: {
            requireAllLinkedSwarmsComplete: true,
            requireNoBlockedSwarms: true,
            requireNoUnresolvedConflicts: true,
            requireCoherentReadiness: true
          }
        }],
        getDefinition: () => ({
          crossSwarmId: 'x',
          displayName: 'X',
          groupType: 'market_shock_cluster',
          enabled: true,
          scope: { teamIds: [], subjectKeys: [] },
          include: { swarmIds: [], teamIds: [], protocolFamilies: [], assetFamilies: [], eventFamilies: [], cohortFamilies: [] },
          requiredMatchDimensions: ['explicit_definition_match'],
          completionRules: {
            requireAllLinkedSwarmsComplete: true,
            requireNoBlockedSwarms: true,
            requireNoUnresolvedConflicts: true,
            requireCoherentReadiness: true
          }
        })
      } as any,
      linker: {
        buildLinks: () => [{
          crossSwarmId: 'x',
          displayName: 'X',
          groupType: 'market_shock_cluster',
          enabled: true,
          linkedSwarmIds: [],
          linkedSwarms: [],
          rationale: []
        }]
      } as any
    });

    const status = projection.projectOne('x');
    expect(status.lifecycleState).toBe('inactive');
    expect(status.readinessState).toBe('pending');
  });

  it('T-CS-S2 classifies progressing and coherent deterministically', () => {
    const projection = createCrossSwarmStatusProjection({
      registry: {
        listDefinitions: () => [{
          crossSwarmId: 'y',
          displayName: 'Y',
          groupType: 'protocol_response_cluster',
          enabled: true,
          scope: { teamIds: [], subjectKeys: [] },
          include: { swarmIds: [], teamIds: [], protocolFamilies: [], assetFamilies: [], eventFamilies: [], cohortFamilies: [] },
          requiredMatchDimensions: ['explicit_definition_match'],
          completionRules: {
            requireAllLinkedSwarmsComplete: false,
            requireNoBlockedSwarms: true,
            requireNoUnresolvedConflicts: true,
            requireCoherentReadiness: false
          }
        }],
        getDefinition: () => ({
          crossSwarmId: 'y',
          displayName: 'Y',
          groupType: 'protocol_response_cluster',
          enabled: true,
          scope: { teamIds: [], subjectKeys: [] },
          include: { swarmIds: [], teamIds: [], protocolFamilies: [], assetFamilies: [], eventFamilies: [], cohortFamilies: [] },
          requiredMatchDimensions: ['explicit_definition_match'],
          completionRules: {
            requireAllLinkedSwarmsComplete: false,
            requireNoBlockedSwarms: true,
            requireNoUnresolvedConflicts: true,
            requireCoherentReadiness: false
          }
        })
      } as any,
      linker: {
        buildLinks: () => [{
          crossSwarmId: 'y',
          displayName: 'Y',
          groupType: 'protocol_response_cluster',
          enabled: true,
          linkedSwarmIds: ['a', 'b'],
          linkedSwarms: [{
            crossSwarmId: 'y',
            swarmId: 'a',
            teamId: 'defi-risk-team',
            swarmDisplayName: 'A',
            lifecycleState: 'progressing',
            readinessState: 'coherent',
            completionSatisfied: true,
            unresolvedConflictCount: 0,
            activeInvestigationCount: 0,
            linkedInvestigationIds: [],
            linkedSynthesisIds: [],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: [],
            cohortFamilies: [],
            rationale: []
          }, {
            crossSwarmId: 'y',
            swarmId: 'b',
            teamId: 'defi-risk-team',
            swarmDisplayName: 'B',
            lifecycleState: 'active',
            readinessState: 'coherent',
            completionSatisfied: false,
            unresolvedConflictCount: 0,
            activeInvestigationCount: 0,
            linkedInvestigationIds: ['inv-1'],
            linkedSynthesisIds: [],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: [],
            cohortFamilies: [],
            rationale: []
          }],
          rationale: []
        }]
      } as any
    });

    const status = projection.projectOne('y');
    expect(status.lifecycleState).toBe('progressing');
    expect(status.readinessState).toBe('coherent');
  });

  it('T-CS-S3 classifies blocked readiness when conflicts present', () => {
    const projection = createCrossSwarmStatusProjection({
      registry: {
        listDefinitions: () => [{
          crossSwarmId: 'z',
          displayName: 'Z',
          groupType: 'governance_risk_cluster',
          enabled: true,
          scope: { teamIds: [], subjectKeys: [] },
          include: { swarmIds: [], teamIds: [], protocolFamilies: [], assetFamilies: [], eventFamilies: [], cohortFamilies: [] },
          requiredMatchDimensions: ['explicit_definition_match'],
          completionRules: {
            requireAllLinkedSwarmsComplete: true,
            requireNoBlockedSwarms: true,
            requireNoUnresolvedConflicts: true,
            requireCoherentReadiness: true
          }
        }],
        getDefinition: () => ({
          crossSwarmId: 'z',
          displayName: 'Z',
          groupType: 'governance_risk_cluster',
          enabled: true,
          scope: { teamIds: [], subjectKeys: [] },
          include: { swarmIds: [], teamIds: [], protocolFamilies: [], assetFamilies: [], eventFamilies: [], cohortFamilies: [] },
          requiredMatchDimensions: ['explicit_definition_match'],
          completionRules: {
            requireAllLinkedSwarmsComplete: true,
            requireNoBlockedSwarms: true,
            requireNoUnresolvedConflicts: true,
            requireCoherentReadiness: true
          }
        })
      } as any,
      linker: {
        buildLinks: () => [{
          crossSwarmId: 'z',
          displayName: 'Z',
          groupType: 'governance_risk_cluster',
          enabled: true,
          linkedSwarmIds: ['a'],
          linkedSwarms: [{
            crossSwarmId: 'z',
            swarmId: 'a',
            teamId: 'governance-monitoring-team',
            swarmDisplayName: 'A',
            lifecycleState: 'stabilizing',
            readinessState: 'blocked',
            completionSatisfied: false,
            unresolvedConflictCount: 2,
            activeInvestigationCount: 1,
            linkedInvestigationIds: ['inv-1'],
            linkedSynthesisIds: ['syn-1'],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: [],
            cohortFamilies: [],
            rationale: []
          }],
          rationale: []
        }]
      } as any
    });

    const status = projection.projectOne('z');
    expect(status.readinessState).toBe('blocked');
    expect(status.conflicts).toEqual(['swarm_conflicts:a:2']);
  });
});
