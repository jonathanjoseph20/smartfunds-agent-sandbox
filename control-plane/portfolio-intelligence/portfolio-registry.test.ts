import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createPortfolioRegistry,
  loadPortfolioDefinitions,
} from './portfolio-registry.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-portfolio-intelligence-definitions');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('portfolio-intelligence registry', () => {
  it('T-PI-R1 loads valid definitions in deterministic order', () => {
    writeJson('zeta.json', {
      portfolioId: 'zeta',
      displayName: 'Zeta',
      portfolioType: 'zeta_type',
      enabled: true,
      matchingRules: {
        eventFamilies: ['market']
      },
      readinessRules: {
        requireAllLinkedSynthesesReady: true
      }
    });
    writeJson('alpha.json', {
      portfolioId: 'alpha',
      displayName: 'Alpha',
      portfolioType: 'alpha_type',
      enabled: true,
      matchingRules: {
        protocolFamilies: ['aave']
      }
    });

    const loaded = loadPortfolioDefinitions({ definitionsDir: tmpRoot });
    expect(loaded.map((entry) => entry.portfolioId)).toEqual(['alpha', 'zeta']);
  });

  it('T-PI-R2 rejects invalid schema', () => {
    writeJson('invalid.json', {
      portfolioId: 'bad',
      displayName: 'Bad',
      portfolioType: 'bad_type',
      enabled: true,
      matchingRules: {
        eventFamilies: [123]
      }
    });

    expect(() => loadPortfolioDefinitions({ definitionsDir: tmpRoot })).toThrow(/matchingRules.eventFamilies/);
  });

  it('T-PI-R3 rejects duplicate portfolio ids', () => {
    const payload = {
      portfolioId: 'dup',
      displayName: 'Dup',
      portfolioType: 'dup_type',
      enabled: true,
      matchingRules: {
        eventFamilies: ['market']
      }
    };

    writeJson('a.json', payload);
    writeJson('b.json', payload);

    expect(() => createPortfolioRegistry({ definitionsDir: tmpRoot })).toThrow(/Duplicate portfolioId detected/);
  });
});
