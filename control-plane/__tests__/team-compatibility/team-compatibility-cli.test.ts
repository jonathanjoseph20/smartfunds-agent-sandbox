import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as historyMain } from '../../cli/team-compatibility-history.ts';
import { main as inspectMain } from '../../cli/team-compatibility-inspect.ts';
import { main as listMain } from '../../cli/team-compatibility-list.ts';
import { main as materializeMain } from '../../cli/team-compatibility-materialize.ts';
import { main as statusMain } from '../../cli/team-compatibility-status.ts';

const {
  listCompatibilitySets,
  inspectCompatibilitySetByMission,
  getCompatibilityStatusByMission,
  getCompatibilityHistoryByMission,
  materializeCompatibilityByMission,
} = vi.hoisted(() => ({
  listCompatibilitySets: vi.fn(() => [{ compatibilitySetId: 'set-1', missionId: 'mission-1', compatibilityState: 'ready', supportedTeamCount: 1, blockedTeamCount: 0 }]),
  inspectCompatibilitySetByMission: vi.fn(() => ({ missionId: 'mission-1', compatibilitySetId: 'set-1', compatibilityState: 'ready' })),
  getCompatibilityStatusByMission: vi.fn(() => ({ missionId: 'mission-1', compatibilityState: 'ready' })),
  getCompatibilityHistoryByMission: vi.fn(() => ({ compatibilitySetId: 'set-1', missionId: 'mission-1', entries: [] })),
  materializeCompatibilityByMission: vi.fn(() => ({ missionId: 'mission-1', compatibilitySetId: 'set-1', statusPath: 'a', reportPath: 'b', markdownPath: 'c', historyPath: 'd' })),
}));

vi.mock('../../team-compatibility/team-compatibility-history-store.ts', () => ({
  createTeamCompatibilityHistoryStore: vi.fn(() => ({
    load: vi.fn(),
    append: vi.fn(),
    write: vi.fn(),
  })),
}));

vi.mock('../../team-compatibility/team-compatibility-inspection.ts', () => ({
  createTeamCompatibilityInspection: vi.fn(() => ({
    listCompatibilitySets,
    inspectCompatibilitySetByMission,
    getCompatibilityStatusByMission,
    getCompatibilityHistoryByMission,
    materializeCompatibilityByMission,
  })),
}));

describe('team compatibility CLI commands', () => {
  it('T-TC-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listCompatibilitySets())}\n`);
    stdout.mockRestore();
  });

  it('T-TC-CLI2 inspect requires --mission', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --mission');
    stdout.mockRestore();
  });

  it('T-TC-CLI3 status routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--mission', 'mission-1']);

    expect(code).toBe(0);
    expect(getCompatibilityStatusByMission).toHaveBeenCalledWith('mission-1');
    stdout.mockRestore();
  });

  it('T-TC-CLI4 history routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--mission=mission-1']);

    expect(code).toBe(0);
    expect(getCompatibilityHistoryByMission).toHaveBeenCalledWith('mission-1');
    stdout.mockRestore();
  });

  it('T-TC-CLI5 materialize routes mission argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--mission', 'mission-1']);

    expect(code).toBe(0);
    expect(materializeCompatibilityByMission).toHaveBeenCalledWith('mission-1');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeCompatibilityByMission())}\n`);
    stdout.mockRestore();
  });

  it('T-TC-CLI6 stable error payload shape is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectCompatibilitySetByMission.mockImplementationOnce(() => {
      throw new Error('MISSION_NOT_FOUND: missing');
    });

    const code = await inspectMain(['--mission', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'MISSION_NOT_FOUND: missing' })}\n`);
    stdout.mockRestore();
  });
});
