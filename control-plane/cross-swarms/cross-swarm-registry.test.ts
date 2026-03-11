import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createCrossSwarmRegistry,
  loadCrossSwarmDefinitions
} from './cross-swarm-registry.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-cross-swarm-definitions');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('cross-swarm registry', () => {
  it('T-CS-R1 loads valid definitions in deterministic order', () => {
    writeJson('zeta.json', {
      crossSwarmId: 'zeta',
      displayName: 'Zeta',
      groupType: 'market_shock_cluster',
      enabled: true,
      scope: { teamIds: ['defi-risk-team'], subjectKeys: ['aave'] },
      include: {
        swarmIds: ['protocol-risk-response'],
        teamIds: ['defi-risk-team'],
        protocolFamilies: ['aave'],
        assetFamilies: [],
        eventFamilies: ['protocol'],
        cohortFamilies: ['aave']
      },
      requiredMatchDimensions: ['explicit_definition_match', 'shared_event_family'],
      completionRules: {
        requireAllLinkedSwarmsComplete: true,
        requireNoBlockedSwarms: true,
        requireNoUnresolvedConflicts: true,
        requireCoherentReadiness: true
      }
    });
    writeJson('alpha.json', {
      crossSwarmId: 'alpha',
      displayName: 'Alpha',
      groupType: 'protocol_response_cluster',
      enabled: true,
      scope: { teamIds: [], subjectKeys: [] },
      include: {
        swarmIds: ['governance-anomaly-response'],
        teamIds: [],
        protocolFamilies: [],
        assetFamilies: [],
        eventFamilies: ['governance'],
        cohortFamilies: []
      },
      requiredMatchDimensions: ['explicit_definition_match'],
      completionRules: {
        requireAllLinkedSwarmsComplete: true,
        requireNoBlockedSwarms: true,
        requireNoUnresolvedConflicts: true,
        requireCoherentReadiness: true
      }
    });

    const loaded = loadCrossSwarmDefinitions({ definitionsDir: tmpRoot });
    expect(loaded.map((entry) => entry.crossSwarmId)).toEqual(['alpha', 'zeta']);
  });

  it('T-CS-R2 rejects invalid schema', () => {
    writeJson('invalid.json', {
      crossSwarmId: 'bad',
      displayName: 'Bad',
      groupType: 'market_shock_cluster',
      enabled: true,
      scope: { teamIds: [], subjectKeys: [] },
      include: {
        swarmIds: [],
        teamIds: [],
        protocolFamilies: [],
        assetFamilies: [],
        eventFamilies: [],
        cohortFamilies: []
      },
      requiredMatchDimensions: [],
      completionRules: {
        requireNoBlockedSwarms: true,
        requireNoUnresolvedConflicts: true,
        requireCoherentReadiness: true
      }
    });

    expect(() => loadCrossSwarmDefinitions({ definitionsDir: tmpRoot })).toThrow(/completionRules/);
  });

  it('T-CS-R3 rejects duplicate crossSwarm ids', () => {
    const payload = {
      crossSwarmId: 'dup',
      displayName: 'Dup',
      groupType: 'market_shock_cluster',
      enabled: true,
      scope: { teamIds: [], subjectKeys: [] },
      include: {
        swarmIds: ['protocol-risk-response'],
        teamIds: [],
        protocolFamilies: [],
        assetFamilies: [],
        eventFamilies: ['protocol'],
        cohortFamilies: []
      },
      requiredMatchDimensions: ['explicit_definition_match'],
      completionRules: {
        requireAllLinkedSwarmsComplete: true,
        requireNoBlockedSwarms: true,
        requireNoUnresolvedConflicts: true,
        requireCoherentReadiness: true
      }
    };

    writeJson('a.json', payload);
    writeJson('b.json', payload);

    expect(() => createCrossSwarmRegistry({ definitionsDir: tmpRoot })).toThrow(/Duplicate crossSwarmId detected/);
  });
});
