import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getMissionPackById, loadMissionPacks } from './mission-packs.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-research-packs');
const packsDir = path.join(tmpRoot, 'packs');
const scheduleRegistryPath = path.join(tmpRoot, 'registry.json');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission packs', () => {
  it('T-MP1 validates schedules against scheduler registry', () => {
    writeJson(scheduleRegistryPath, {
      schemaVersion: 1,
      schedules: [
        {
          scheduleId: 'scan-a',
          missionId: 'mission-a',
          enabled: true,
          cadence: { type: 'daily' }
        },
        {
          scheduleId: 'scan-b',
          missionId: 'mission-b',
          enabled: true,
          cadence: { type: 'daily' }
        }
      ]
    });

    writeJson(path.join(packsDir, 'pack.json'), {
      packId: 'pack-a',
      teamId: 'team-a',
      schedules: ['scan-b', 'scan-a'],
      summaryScheduleId: 'scan-a'
    });

    const packs = loadMissionPacks({ packsDir, scheduleRegistryPath });
    expect(packs).toHaveLength(1);
    expect(packs[0].schedules).toEqual(['scan-a', 'scan-b']);
  });

  it('T-MP2 rejects unknown schedule ids', () => {
    writeJson(scheduleRegistryPath, {
      schemaVersion: 1,
      schedules: [
        {
          scheduleId: 'known',
          missionId: 'mission-a',
          enabled: true,
          cadence: { type: 'daily' }
        }
      ]
    });

    writeJson(path.join(packsDir, 'pack.json'), {
      packId: 'pack-a',
      teamId: 'team-a',
      schedules: ['known', 'unknown']
    });

    expect(() => loadMissionPacks({ packsDir, scheduleRegistryPath })).toThrow(/unknown schedules/);
  });

  it('T-MP3 resolves pack by id', () => {
    writeJson(scheduleRegistryPath, {
      schemaVersion: 1,
      schedules: [
        {
          scheduleId: 'known',
          missionId: 'mission-a',
          enabled: true,
          cadence: { type: 'daily' }
        }
      ]
    });

    writeJson(path.join(packsDir, 'pack.json'), {
      packId: 'pack-a',
      teamId: 'team-a',
      schedules: ['known']
    });

    const pack = getMissionPackById({ packId: 'pack-a', packsDir, scheduleRegistryPath });
    expect(pack.packId).toBe('pack-a');
  });
});
