import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createMissionRegistry,
  loadMissionDefinitions,
} from '../../missions/mission-registry.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-registry');

function writeJson(fileName: string, value: unknown): void {
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('missions registry', () => {
  it('T-M1 loads definitions in deterministic order', () => {
    writeJson('zeta.json', {
      missionType: 'zeta-mission',
      displayName: 'Zeta Mission',
      enabled: true,
      description: 'zeta',
      defaultObjective: 'zeta objective',
      defaultDeliverables: ['memo'],
      allowedSourceKinds: ['memo'],
      defaultPriority: 'normal',
      defaultLifecycleState: 'draft',
      tags: ['zeta'],
    });

    writeJson('alpha.json', {
      missionType: 'alpha-mission',
      displayName: 'Alpha Mission',
      enabled: true,
      description: 'alpha',
      defaultObjective: 'alpha objective',
      defaultDeliverables: ['memo'],
      allowedSourceKinds: ['memo'],
      defaultPriority: 'normal',
      defaultLifecycleState: 'draft',
      tags: ['alpha'],
    });

    const loaded = loadMissionDefinitions({ definitionsDir: tmpRoot });
    expect(loaded.map((entry) => entry.missionType)).toEqual(['alpha-mission', 'zeta-mission']);
  });

  it('T-M2 rejects invalid definitions', () => {
    writeJson('invalid.json', {
      missionType: 'invalid',
      displayName: 'Invalid',
      enabled: true,
      description: 'invalid',
      defaultObjective: 'invalid objective',
      defaultDeliverables: [123],
      allowedSourceKinds: ['memo'],
      defaultPriority: 'normal',
      defaultLifecycleState: 'draft',
      tags: ['invalid'],
    });

    expect(() => loadMissionDefinitions({ definitionsDir: tmpRoot })).toThrow(/defaultDeliverables/);
  });

  it('T-M3 rejects duplicate mission type definitions', () => {
    const definition = {
      missionType: 'dup-mission',
      displayName: 'Dup Mission',
      enabled: true,
      description: 'dup',
      defaultObjective: 'dup objective',
      defaultDeliverables: ['memo'],
      allowedSourceKinds: ['memo'],
      defaultPriority: 'normal',
      defaultLifecycleState: 'draft',
      tags: ['dup'],
    };

    writeJson('a.json', definition);
    writeJson('b.json', definition);

    expect(() => createMissionRegistry({ definitionsDir: tmpRoot, instancesDir: path.join(tmpRoot, 'instances') })).toThrow(/MISSION_DUPLICATE_DEFINITION/);
  });
});
