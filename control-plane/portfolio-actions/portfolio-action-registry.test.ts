import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createPortfolioActionRegistry,
  loadActionDefinitions,
} from './portfolio-action-registry.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-portfolio-action-definitions');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('portfolio-actions registry', () => {
  it('T-PA-R1 loads valid definitions in deterministic order', () => {
    writeJson('zeta.json', {
      actionId: 'zeta',
      displayName: 'Zeta',
      actionType: 'zeta_type',
      enabled: true,
      portfolioMatchRules: {
        riskThemes: ['governance_risk_rising']
      }
    });
    writeJson('alpha.json', {
      actionId: 'alpha',
      displayName: 'Alpha',
      actionType: 'alpha_type',
      enabled: true,
      portfolioMatchRules: {
        marketEventFamilies: ['liquidity']
      }
    });

    const loaded = loadActionDefinitions({ definitionsDir: tmpRoot });
    expect(loaded.map((entry) => entry.actionId)).toEqual(['alpha', 'zeta']);
  });

  it('T-PA-R2 rejects invalid schema', () => {
    writeJson('invalid.json', {
      actionId: 'bad',
      displayName: 'Bad',
      actionType: 'bad_type',
      enabled: true,
      portfolioMatchRules: {
        riskThemes: [123]
      }
    });

    expect(() => loadActionDefinitions({ definitionsDir: tmpRoot })).toThrow(/portfolioMatchRules.riskThemes/);
  });

  it('T-PA-R3 rejects duplicate action ids', () => {
    const payload = {
      actionId: 'dup',
      displayName: 'Dup',
      actionType: 'dup_type',
      enabled: true,
      portfolioMatchRules: {
        riskThemes: ['liquidity_stress']
      }
    };

    writeJson('a.json', payload);
    writeJson('b.json', payload);

    expect(() => createPortfolioActionRegistry({ definitionsDir: tmpRoot })).toThrow(/Duplicate actionId detected/);
  });
});
