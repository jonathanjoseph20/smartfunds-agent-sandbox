import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTeamRegistry, loadTeams } from '../../teams/team-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-team-registry');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validDefinition(teamId: string): Record<string, unknown> {
  return {
    teamId,
    displayName: `${teamId} display`,
    description: 'desc',
    teamType: 'venture',
    purpose: 'purpose',
    domainTags: ['startup'],
    supportedMissionTypes: ['produce-market-memo'],
    supportedTemplateIds: ['produce-market-memo'],
    capabilityTags: ['market_synthesis'],
    defaultOperatingMode: 'on_demand',
    lifecycleState: 'active',
    availabilityState: 'manual_only',
    readinessState: 'ready',
    rosterPolicy: { type: 'fixed', minAgents: 1, maxAgents: 1, requiredCapabilities: ['market_synthesis'] },
    notes: ['note'],
  };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('team registry', () => {
  it('T-TR1 definitions load in deterministic order', () => {
    writeJson('zeta.json', validDefinition('zeta-team'));
    writeJson('alpha.json', validDefinition('alpha-team'));

    const loaded = loadTeams({ definitionsDir: tmpRoot });
    expect(loaded.map((entry) => entry.teamId)).toEqual(['alpha-team', 'zeta-team']);
  });

  it('T-TR2 invalid definitions fail', () => {
    writeJson('invalid.json', validDefinition('bad-team'));
    writeJson('invalid-two.json', { teamId: 'bad-team-2', displayName: 'Bad Team 2', teamType: 'venture' });

    expect(() => loadTeams({ definitionsDir: tmpRoot })).toThrow(/TEAM_INVALID_DEFINITION/);
  });

  it('T-TR3 duplicate IDs rejected', () => {
    writeJson('a.json', validDefinition('dup-team'));
    writeJson('b.json', validDefinition('dup-team'));

    expect(() => createTeamRegistry({ definitionsDir: tmpRoot })).toThrow(/TEAM_DUPLICATE_ID/);
  });
});
