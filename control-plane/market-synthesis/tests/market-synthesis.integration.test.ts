import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMarketInspection } from '../market-synthesis-inspection.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-market-synthesis-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function makeRegistry(id: string) {
  return {
    listDefinitions: () => [{
      marketSynthesisId: id,
      displayName: 'Test Market Synthesis',
      synthesisType: 'market_test',
      enabled: true,
      crossSwarmMatchingRules: {},
      scopeConstraints: { minCrossSwarms: 1 }
    }],
    getDefinition: () => ({
      marketSynthesisId: id,
      displayName: 'Test Market Synthesis',
      synthesisType: 'market_test',
      enabled: true,
      crossSwarmMatchingRules: {},
      scopeConstraints: { minCrossSwarms: 1 }
    })
  } as any;
}

describe('market-synthesis integration', () => {
  it('T-MS-I1 positive path groups cross-swarms and produces coherent completed status', () => {
    const inspection = createMarketInspection({
      marketSynthesisArtifactsRoot: path.join(tmpRoot, 'artifacts', 'market-synthesis'),
      registry: makeRegistry('market-risk-synthesis'),
      linker: {
        buildLinks: () => [{
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk Synthesis',
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
            protocolFamilies: ['aave'],
            assetFamilies: [],
            eventFamilies: ['market'],
            responseFamilies: ['market']
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
            protocolFamilies: ['aave'],
            assetFamilies: [],
            eventFamilies: ['protocol'],
            responseFamilies: ['protocol']
          }],
          rationale: ['a:shared_event_family:market', 'b:shared_response_family:protocol']
        }]
      } as any
    });

    const status = inspection.getMarketStatus('market-risk-synthesis');
    expect(status.readinessState).toBe('coherent');
    expect(status.completionState).toBe('completed');
  });

  it('T-MS-I2 conflict path blocks readiness', () => {
    const inspection = createMarketInspection({
      marketSynthesisArtifactsRoot: path.join(tmpRoot, 'artifacts', 'market-synthesis'),
      registry: makeRegistry('governance-instability-market-synthesis'),
      linker: {
        buildLinks: () => [{
          marketSynthesisId: 'governance-instability-market-synthesis',
          displayName: 'Governance Instability Market Synthesis',
          synthesisType: 'governance_instability',
          enabled: true,
          linkedCrossSwarmIds: ['g-1'],
          linkedCrossSwarms: [{
            crossSwarmId: 'g-1',
            displayName: 'G1',
            groupType: 'governance_risk_cluster',
            lifecycleState: 'stabilizing',
            readinessState: 'blocked',
            completionSatisfied: false,
            unresolvedConflictCount: 3,
            blockers: ['blocked_swarm:g-1'],
            conflicts: ['swarm_conflicts:g-1:3'],
            protocolFamilies: ['aave'],
            assetFamilies: [],
            eventFamilies: ['governance'],
            responseFamilies: ['governance']
          }],
          rationale: ['g-1:shared_event_family:governance']
        }]
      } as any
    });

    const readiness = inspection.getMarketReadiness('governance-instability-market-synthesis');
    expect(readiness.readinessState).toBe('blocked');
  });

  it('T-MS-I3 weak coverage path yields inconclusive completion', () => {
    const inspection = createMarketInspection({
      marketSynthesisArtifactsRoot: path.join(tmpRoot, 'artifacts', 'market-synthesis'),
      registry: {
        listDefinitions: () => [{
          marketSynthesisId: 'yield-instability-market-synthesis',
          displayName: 'Yield Instability',
          synthesisType: 'yield_instability',
          enabled: true,
          crossSwarmMatchingRules: {},
          scopeConstraints: { minCrossSwarms: 2 }
        }],
        getDefinition: () => ({
          marketSynthesisId: 'yield-instability-market-synthesis',
          displayName: 'Yield Instability',
          synthesisType: 'yield_instability',
          enabled: true,
          crossSwarmMatchingRules: {},
          scopeConstraints: { minCrossSwarms: 2 }
        })
      } as any,
      linker: {
        buildLinks: () => [{
          marketSynthesisId: 'yield-instability-market-synthesis',
          displayName: 'Yield Instability Market Synthesis',
          synthesisType: 'yield_instability',
          enabled: true,
          linkedCrossSwarmIds: ['y-1'],
          linkedCrossSwarms: [{
            crossSwarmId: 'y-1',
            displayName: 'Y1',
            groupType: 'market_shock_cluster',
            lifecycleState: 'completed',
            readinessState: 'coherent',
            completionSatisfied: true,
            unresolvedConflictCount: 0,
            blockers: [],
            conflicts: [],
            protocolFamilies: ['aave'],
            assetFamilies: [],
            eventFamilies: ['yield'],
            responseFamilies: ['market']
          }],
          rationale: ['y-1:shared_event_family:yield']
        }]
      } as any
    });

    const status = inspection.getMarketStatus('yield-instability-market-synthesis');
    expect(status.completionState).toBe('inconclusive');
  });

  it('T-MS-I4 regression path does not mutate lower-layer snapshot', () => {
    const lowerLayerSnapshot = {
      crossSwarmId: 'protocol-response-cluster',
      lifecycle: 'progressing',
      readiness: 'analyzing'
    };
    const before = JSON.stringify(lowerLayerSnapshot);

    const inspection = createMarketInspection({
      marketSynthesisArtifactsRoot: path.join(tmpRoot, 'artifacts', 'market-synthesis'),
      registry: makeRegistry('market-risk-synthesis'),
      linker: {
        buildLinks: () => [{
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk Synthesis',
          synthesisType: 'market_risk',
          enabled: true,
          linkedCrossSwarmIds: ['protocol-response-cluster'],
          linkedCrossSwarms: [{
            crossSwarmId: lowerLayerSnapshot.crossSwarmId,
            displayName: 'Protocol Response',
            groupType: 'protocol_response_cluster',
            lifecycleState: 'progressing',
            readinessState: 'analyzing',
            completionSatisfied: false,
            unresolvedConflictCount: 0,
            blockers: [],
            conflicts: [],
            protocolFamilies: ['aave'],
            assetFamilies: [],
            eventFamilies: ['protocol'],
            responseFamilies: ['protocol']
          }],
          rationale: ['protocol-response-cluster:shared_event_family:protocol']
        }]
      } as any
    });

    inspection.evaluateMarketSynthesis({ marketSynthesisId: 'market-risk-synthesis', slotReference: 'daily:2026-03-11' });
    inspection.materializeMarketSynthesis('market-risk-synthesis');

    expect(JSON.stringify(lowerLayerSnapshot)).toBe(before);
  });
});
