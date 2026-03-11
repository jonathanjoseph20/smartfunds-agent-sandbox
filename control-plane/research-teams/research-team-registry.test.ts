import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createResearchTeamRegistry, loadResearchTeamDefinitions } from './research-team-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-research-team-definitions');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('research team registry', () => {
  it('T-RT-R1 loads valid definitions in deterministic order', () => {
    writeJson('zeta.json', {
      teamId: 'zeta',
      displayName: 'Zeta Team',
      teamType: 'risk',
      enabled: true,
      attachmentRules: {
        cohortIds: ['z-1']
      }
    });
    writeJson('alpha.json', {
      teamId: 'alpha',
      displayName: 'Alpha Team',
      teamType: 'risk',
      enabled: true,
      attachmentRules: {
        cohortTypes: ['defi-risk', 'defi-risk']
      }
    });

    const loaded = loadResearchTeamDefinitions({ definitionsDir: tmpRoot });
    expect(loaded.map((entry) => entry.teamId)).toEqual(['alpha', 'zeta']);
    expect(loaded[0]?.attachmentRules.cohortTypes).toEqual(['defi-risk']);
  });

  it('T-RT-R2 rejects invalid schema', () => {
    writeJson('invalid.json', {
      teamId: 'bad-team',
      displayName: 'Bad Team',
      teamType: 'risk',
      enabled: true,
      attachmentRules: {}
    });

    expect(() => loadResearchTeamDefinitions({ definitionsDir: tmpRoot })).toThrow(/attachmentRules must provide at least one rule array/);
  });

  it('T-RT-R3 rejects duplicate team ids', () => {
    writeJson('a.json', {
      teamId: 'dup',
      displayName: 'A',
      teamType: 'risk',
      enabled: true,
      attachmentRules: { cohortIds: ['a'] }
    });
    writeJson('b.json', {
      teamId: 'dup',
      displayName: 'B',
      teamType: 'risk',
      enabled: true,
      attachmentRules: { cohortIds: ['b'] }
    });

    expect(() => createResearchTeamRegistry({ definitionsDir: tmpRoot })).toThrow(/Duplicate research teamId detected/);
  });
});
