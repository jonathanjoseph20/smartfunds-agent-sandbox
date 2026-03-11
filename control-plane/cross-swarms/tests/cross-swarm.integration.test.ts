import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCrossSwarmInspection } from '../cross-swarm-inspection.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-cross-swarm-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function makeRegistry(definitionId: string) {
  return {
    listDefinitions: () => [{
      crossSwarmId: definitionId,
      displayName: 'Test Cluster',
      groupType: 'protocol_response_cluster',
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
      crossSwarmId: definitionId,
      displayName: 'Test Cluster',
      groupType: 'protocol_response_cluster',
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
  } as any;
}

describe('cross-swarm integration', () => {
  it('T-CS-I1 positive path groups related swarms and reaches coherent/completed projection', () => {
    const inspection = createCrossSwarmInspection({
      crossSwarmArtifactsRoot: path.join(tmpRoot, 'artifacts', 'cross-swarms'),
      registry: makeRegistry('protocol-response-cluster'),
      linker: {
        buildLinks: () => [{
          crossSwarmId: 'protocol-response-cluster',
          displayName: 'Protocol Response Cluster',
          groupType: 'protocol_response_cluster',
          enabled: true,
          linkedSwarmIds: ['a', 'b'],
          linkedSwarms: [
            {
              crossSwarmId: 'protocol-response-cluster',
              swarmId: 'a',
              teamId: 'defi-risk-team',
              swarmDisplayName: 'A',
              lifecycleState: 'completed',
              readinessState: 'coherent',
              completionSatisfied: true,
              unresolvedConflictCount: 0,
              activeInvestigationCount: 0,
              linkedInvestigationIds: ['inv-1'],
              linkedSynthesisIds: ['syn-1'],
              protocolFamilies: ['aave'],
              assetFamilies: [],
              eventFamilies: ['protocol'],
              cohortFamilies: ['aave'],
              rationale: []
            },
            {
              crossSwarmId: 'protocol-response-cluster',
              swarmId: 'b',
              teamId: 'defi-risk-team',
              swarmDisplayName: 'B',
              lifecycleState: 'completed',
              readinessState: 'coherent',
              completionSatisfied: true,
              unresolvedConflictCount: 0,
              activeInvestigationCount: 0,
              linkedInvestigationIds: ['inv-2'],
              linkedSynthesisIds: ['syn-2'],
              protocolFamilies: ['aave'],
              assetFamilies: [],
              eventFamilies: ['protocol'],
              cohortFamilies: ['aave'],
              rationale: []
            }
          ],
          rationale: []
        }]
      } as any
    });

    const status = inspection.getCrossSwarmStatus('protocol-response-cluster');
    expect(status.readinessState).toBe('coherent');
    expect(status.completion.isComplete).toBe(true);
  });

  it('T-CS-I2 conflict-heavy path remains blocked with surfaced conflicts', () => {
    const inspection = createCrossSwarmInspection({
      crossSwarmArtifactsRoot: path.join(tmpRoot, 'artifacts', 'cross-swarms'),
      registry: makeRegistry('governance-risk-cluster'),
      linker: {
        buildLinks: () => [{
          crossSwarmId: 'governance-risk-cluster',
          displayName: 'Governance Risk Cluster',
          groupType: 'governance_risk_cluster',
          enabled: true,
          linkedSwarmIds: ['g-1'],
          linkedSwarms: [{
            crossSwarmId: 'governance-risk-cluster',
            swarmId: 'g-1',
            teamId: 'governance-monitoring-team',
            swarmDisplayName: 'Governance',
            lifecycleState: 'stabilizing',
            readinessState: 'blocked',
            completionSatisfied: false,
            unresolvedConflictCount: 3,
            activeInvestigationCount: 1,
            linkedInvestigationIds: ['inv-g1'],
            linkedSynthesisIds: ['syn-g1'],
            protocolFamilies: ['aave'],
            assetFamilies: [],
            eventFamilies: ['governance'],
            cohortFamilies: ['aave'],
            rationale: []
          }],
          rationale: []
        }]
      } as any
    });

    const readiness = inspection.getCrossSwarmReadiness('governance-risk-cluster');
    expect(readiness.readinessState).toBe('blocked');
    expect(readiness.conflicts).toEqual(['swarm_conflicts:g-1:3']);
  });

  it('T-CS-I3 partial completion path stays incomplete', () => {
    const inspection = createCrossSwarmInspection({
      crossSwarmArtifactsRoot: path.join(tmpRoot, 'artifacts', 'cross-swarms'),
      registry: makeRegistry('market-shock-cluster'),
      linker: {
        buildLinks: () => [{
          crossSwarmId: 'market-shock-cluster',
          displayName: 'Market Shock Cluster',
          groupType: 'market_shock_cluster',
          enabled: true,
          linkedSwarmIds: ['m-1', 'm-2'],
          linkedSwarms: [{
            crossSwarmId: 'market-shock-cluster',
            swarmId: 'm-1',
            teamId: 'yield-anomaly-team',
            swarmDisplayName: 'M1',
            lifecycleState: 'completed',
            readinessState: 'coherent',
            completionSatisfied: true,
            unresolvedConflictCount: 0,
            activeInvestigationCount: 0,
            linkedInvestigationIds: ['inv-m1'],
            linkedSynthesisIds: [],
            protocolFamilies: ['aave'],
            assetFamilies: [],
            eventFamilies: ['yield'],
            cohortFamilies: ['aave'],
            rationale: []
          }, {
            crossSwarmId: 'market-shock-cluster',
            swarmId: 'm-2',
            teamId: 'yield-anomaly-team',
            swarmDisplayName: 'M2',
            lifecycleState: 'active',
            readinessState: 'analyzing',
            completionSatisfied: false,
            unresolvedConflictCount: 0,
            activeInvestigationCount: 1,
            linkedInvestigationIds: ['inv-m2'],
            linkedSynthesisIds: [],
            protocolFamilies: ['aave'],
            assetFamilies: [],
            eventFamilies: ['yield'],
            cohortFamilies: ['aave'],
            rationale: []
          }],
          rationale: []
        }]
      } as any
    });

    const status = inspection.getCrossSwarmStatus('market-shock-cluster');
    expect(status.completion.isComplete).toBe(false);
    expect(status.completion.unmetRequirements).toContain('incomplete_swarms:1');
  });

  it('T-CS-I4 regression path leaves lower-layer snapshots unchanged', () => {
    const lowerLayerSnapshot = {
      swarmId: 'protocol-risk-response',
      lifecycle: 'progressing',
      readiness: 'analyzing'
    };
    const before = JSON.stringify(lowerLayerSnapshot);

    const inspection = createCrossSwarmInspection({
      crossSwarmArtifactsRoot: path.join(tmpRoot, 'artifacts', 'cross-swarms'),
      registry: makeRegistry('protocol-response-cluster'),
      linker: {
        buildLinks: () => [{
          crossSwarmId: 'protocol-response-cluster',
          displayName: 'Protocol Response Cluster',
          groupType: 'protocol_response_cluster',
          enabled: true,
          linkedSwarmIds: ['protocol-risk-response'],
          linkedSwarms: [{
            crossSwarmId: 'protocol-response-cluster',
            swarmId: lowerLayerSnapshot.swarmId,
            teamId: 'defi-risk-team',
            swarmDisplayName: 'Protocol Risk Response',
            lifecycleState: 'progressing',
            readinessState: 'analyzing',
            completionSatisfied: false,
            unresolvedConflictCount: 0,
            activeInvestigationCount: 1,
            linkedInvestigationIds: ['inv-1'],
            linkedSynthesisIds: [],
            protocolFamilies: ['aave'],
            assetFamilies: [],
            eventFamilies: ['protocol'],
            cohortFamilies: ['aave'],
            rationale: []
          }],
          rationale: []
        }]
      } as any
    });

    inspection.evaluateCrossSwarm({ crossSwarmId: 'protocol-response-cluster', slotReference: 'daily:2026-03-11' });
    inspection.materializeCrossSwarm('protocol-response-cluster');

    expect(JSON.stringify(lowerLayerSnapshot)).toBe(before);
  });
});
