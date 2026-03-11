import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as historyMain } from '../../cli/missions-history.ts';
import { main as inspectMain } from '../../cli/missions-inspect.ts';
import { main as listMain } from '../../cli/missions-list.ts';
import { main as materializeMain } from '../../cli/missions-materialize.ts';
import { main as statusMain } from '../../cli/missions-status.ts';

const {
  listMissions,
  inspectMission,
  getMissionStatus,
  getMissionHistory,
  materializeMission,
} = vi.hoisted(() => ({
  listMissions: vi.fn(() => [{ missionId: 'mission-1', missionType: 'produce-market-memo' }]),
  inspectMission: vi.fn(() => ({ missionId: 'mission-1', missionType: 'produce-market-memo', status: { lifecycleState: 'draft' } })),
  getMissionStatus: vi.fn(() => ({ missionId: 'mission-1', lifecycleState: 'draft', readinessState: 'pending' })),
  getMissionHistory: vi.fn(() => ({ missionId: 'mission-1', entries: [] })),
  materializeMission: vi.fn(() => ({ missionId: 'mission-1', statusPath: 'a', reportPath: 'b', markdownPath: 'c', historyPath: 'd' })),
}));

vi.mock('../../missions/mission-inspection.ts', () => ({
  createMissionInspection: vi.fn(() => ({
    listMissions,
    inspectMission,
    getMissionStatus,
    getMissionHistory,
    materializeMission,
  })),
}));

describe('missions CLI commands', () => {
  it('T-MCLI1 missions:list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listMissions())}\n`);
    stdout.mockRestore();
  });

  it('T-MCLI2 missions:inspect requires --mission', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --mission');
    stdout.mockRestore();
  });

  it('T-MCLI3 missions:status routes --mission', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--mission', 'mission-1']);

    expect(code).toBe(0);
    expect(getMissionStatus).toHaveBeenCalledWith('mission-1');
    stdout.mockRestore();
  });

  it('T-MCLI4 missions:history routes --mission', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--mission=mission-1']);

    expect(code).toBe(0);
    expect(getMissionHistory).toHaveBeenCalledWith('mission-1');
    stdout.mockRestore();
  });

  it('T-MCLI5 missions:materialize routes --mission', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--mission', 'mission-1']);

    expect(code).toBe(0);
    expect(materializeMission).toHaveBeenCalledWith('mission-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeMission())}\n`);
    stdout.mockRestore();
  });

  it('T-MCLI6 missing mission returns stable error payload shape', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectMission.mockImplementationOnce(() => {
      throw new Error('MISSION_NOT_FOUND: missing');
    });

    const code = await inspectMain(['--mission', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSION_NOT_FOUND: missing' })}\n`);
    stdout.mockRestore();
  });
});
