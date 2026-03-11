import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createMarketSynthesisRegistry,
  loadMarketSynthesisDefinitions,
} from './market-synthesis-registry.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-market-synthesis-definitions');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('market-synthesis registry', () => {
  it('T-MS-R1 loads valid definitions in deterministic order', () => {
    writeJson('zeta.json', {
      marketSynthesisId: 'zeta',
      displayName: 'Zeta',
      synthesisType: 'zeta_type',
      enabled: true,
      crossSwarmMatchingRules: {
        eventFamilies: ['market']
      },
      scopeConstraints: {
        minCrossSwarms: 2
      }
    });
    writeJson('alpha.json', {
      marketSynthesisId: 'alpha',
      displayName: 'Alpha',
      synthesisType: 'alpha_type',
      enabled: true,
      crossSwarmMatchingRules: {
        responseFamilies: ['protocol']
      }
    });

    const loaded = loadMarketSynthesisDefinitions({ definitionsDir: tmpRoot });
    expect(loaded.map((entry) => entry.marketSynthesisId)).toEqual(['alpha', 'zeta']);
  });

  it('T-MS-R2 rejects invalid schema', () => {
    writeJson('invalid.json', {
      marketSynthesisId: 'bad',
      displayName: 'Bad',
      synthesisType: 'bad_type',
      enabled: true,
      crossSwarmMatchingRules: {
        eventFamilies: [123]
      }
    });

    expect(() => loadMarketSynthesisDefinitions({ definitionsDir: tmpRoot })).toThrow(/crossSwarmMatchingRules.eventFamilies/);
  });

  it('T-MS-R3 rejects duplicate market synthesis ids', () => {
    const payload = {
      marketSynthesisId: 'dup',
      displayName: 'Dup',
      synthesisType: 'dup_type',
      enabled: true,
      crossSwarmMatchingRules: {
        eventFamilies: ['market']
      }
    };

    writeJson('a.json', payload);
    writeJson('b.json', payload);

    expect(() => createMarketSynthesisRegistry({ definitionsDir: tmpRoot })).toThrow(/Duplicate marketSynthesisId detected/);
  });
});
