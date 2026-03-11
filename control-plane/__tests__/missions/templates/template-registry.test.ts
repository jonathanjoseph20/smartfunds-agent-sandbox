import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  getMissionTemplate,
  listMissionTemplates,
  loadMissionTemplates,
} from '../../../missions/templates/mission-template-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-templates-registry');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validTemplate(templateId: string, missionType = templateId): Record<string, unknown> {
  return {
    templateId,
    missionType,
    displayName: templateId,
    description: `${templateId} description`,
    parameters: {
      alpha: {
        type: 'string',
        required: true,
      },
    },
    defaultObjectiveTemplate: 'Evaluate {{alpha}}',
    defaultDeliverablesTemplate: ['memo'],
    allowedSourceKinds: ['market-intelligence'],
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission template registry', () => {
  it('T-MTPL-R0 loads all shipped template definitions', () => {
    const loaded = loadMissionTemplates();
    expect(loaded.map((template) => template.templateId)).toEqual([
      'analyze-agent-economy-development',
      'evaluate-startup-opportunity',
      'generate-product-spec',
      'produce-market-memo',
      'structure-tokenized-offering',
    ]);
  });

  it('T-MTPL-R1 loads templates in deterministic templateId order', () => {
    writeJson('zeta.json', validTemplate('zeta'));
    writeJson('alpha.json', validTemplate('alpha'));

    const loaded = loadMissionTemplates({ definitionsDir: tmpRoot });

    expect(loaded.map((template) => template.templateId)).toEqual(['alpha', 'zeta']);
  });

  it('T-MTPL-R2 rejects duplicate template ids', () => {
    writeJson('one.json', validTemplate('duplicate', 'type-a'));
    writeJson('two.json', validTemplate('duplicate', 'type-b'));

    expect(() => loadMissionTemplates({ definitionsDir: tmpRoot })).toThrow('Duplicate mission template: duplicate');
  });

  it('T-MTPL-R3 getMissionTemplate rejects unknown template id', () => {
    writeJson('alpha.json', validTemplate('alpha'));

    expect(() => getMissionTemplate('unknown', { definitionsDir: tmpRoot })).toThrow('Unknown mission template: unknown');
  });

  it('T-MTPL-R4 filename loading order does not affect deterministic results', () => {
    writeJson('zzz.json', validTemplate('gamma'));
    writeJson('aaa.json', validTemplate('beta'));
    writeJson('mmm.json', validTemplate('alpha'));

    const first = listMissionTemplates({ definitionsDir: tmpRoot }).map((entry) => entry.templateId);
    const second = listMissionTemplates({ definitionsDir: tmpRoot }).map((entry) => entry.templateId);

    expect(first).toEqual(['alpha', 'beta', 'gamma']);
    expect(second).toEqual(first);
  });
});
