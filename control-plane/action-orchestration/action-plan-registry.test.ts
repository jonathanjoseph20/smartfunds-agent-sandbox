import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createActionPlanRegistry,
  loadActionPlanDefinitions,
} from './action-plan-registry.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-action-plan-definitions');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('action-orchestration registry', () => {
  it('T-AO-R1 loads valid definitions in deterministic order', () => {
    writeJson('zeta.json', {
      actionPlanId: 'zeta',
      displayName: 'Zeta',
      planType: 'zeta_plan',
      enabled: true,
      matchingRules: {
        routeCategories: ['review'],
      }
    });

    writeJson('alpha.json', {
      actionPlanId: 'alpha',
      displayName: 'Alpha',
      planType: 'alpha_plan',
      enabled: true,
      matchingRules: {
        riskThemes: ['liquidity_stress'],
      }
    });

    const loaded = loadActionPlanDefinitions({ definitionsDir: tmpRoot });
    expect(loaded.map((entry) => entry.actionPlanId)).toEqual(['alpha', 'zeta']);
  });

  it('T-AO-R2 rejects invalid schema', () => {
    writeJson('invalid.json', {
      actionPlanId: 'bad',
      displayName: 'Bad',
      planType: 'bad_plan',
      enabled: true,
      matchingRules: {
        riskThemes: [123],
      }
    });

    expect(() => loadActionPlanDefinitions({ definitionsDir: tmpRoot })).toThrow(/matchingRules.riskThemes/);
  });

  it('T-AO-R3 rejects duplicate plan ids', () => {
    const payload = {
      actionPlanId: 'dup',
      displayName: 'Dup',
      planType: 'dup_plan',
      enabled: true,
      matchingRules: {
        routeCategories: ['monitor'],
      }
    };

    writeJson('a.json', payload);
    writeJson('b.json', payload);

    expect(() => createActionPlanRegistry({ definitionsDir: tmpRoot })).toThrow(/Duplicate actionPlanId detected/);
  });
});
