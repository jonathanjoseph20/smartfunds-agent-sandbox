import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getResearchTeamById, loadResearchTeams } from './team-registry.ts';

const tmpDir = path.join('control-plane', '__tests__', 'tmp-research-team-registry');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('research team registry', () => {
  it('T-M1 loads teams in deterministic order', () => {
    writeJson('zeta.json', {
      teamId: 'zeta',
      missionPackId: 'pack-zeta',
      description: 'zeta team'
    });
    writeJson('alpha.json', {
      teamId: 'alpha',
      missionPackId: 'pack-alpha',
      description: 'alpha team',
      datasetKeys: ['b', 'a']
    });

    const loaded = loadResearchTeams(tmpDir);
    expect(loaded.map((entry) => entry.teamId)).toEqual(['alpha', 'zeta']);
    expect(loaded[0].datasetKeys).toEqual(['a', 'b']);
  });

  it('T-M2 rejects duplicate team ids', () => {
    writeJson('a.json', {
      teamId: 'dup',
      missionPackId: 'pack-a',
      description: 'team a'
    });
    writeJson('b.json', {
      teamId: 'dup',
      missionPackId: 'pack-b',
      description: 'team b'
    });

    expect(() => loadResearchTeams(tmpDir)).toThrow(/Duplicate research teamId/);
  });

  it('T-M3 resolves team by id', () => {
    writeJson('alpha.json', {
      teamId: 'alpha',
      missionPackId: 'pack-alpha',
      description: 'alpha team'
    });

    const team = getResearchTeamById('alpha', tmpDir);
    expect(team.teamId).toBe('alpha');
    expect(() => getResearchTeamById('missing', tmpDir)).toThrow('RESEARCH_TEAM_NOT_FOUND: missing');
  });
});
