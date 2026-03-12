import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as historyMain } from '../../cli/teams-history.ts';
import { main as inspectMain } from '../../cli/teams-inspect.ts';
import { main as listMain } from '../../cli/teams-list.ts';
import { main as materializeMain } from '../../cli/teams-materialize.ts';
import { main as statusMain } from '../../cli/teams-status.ts';

const {
  listTeams,
  inspectTeam,
  getTeamStatus,
  getTeamHistory,
  materializeTeam,
} = vi.hoisted(() => ({
  listTeams: vi.fn(() => [{ teamId: 'venture-opportunity-team', teamType: 'venture' }]),
  inspectTeam: vi.fn(() => ({ teamId: 'venture-opportunity-team', status: { readinessState: 'ready' } })),
  getTeamStatus: vi.fn(() => ({ teamId: 'venture-opportunity-team', readinessState: 'ready' })),
  getTeamHistory: vi.fn(() => ({ teamId: 'venture-opportunity-team', entries: [] })),
  materializeTeam: vi.fn(() => ({ teamId: 'venture-opportunity-team', statusPath: 'a', reportPath: 'b', markdownPath: 'c', historyPath: 'd' })),
}));

vi.mock('../../teams/team-inspection.ts', () => ({
  createTeamInspection: vi.fn(() => ({
    listTeams,
    inspectTeam,
    getTeamStatus,
    getTeamHistory,
    materializeTeam,
  })),
}));

describe('teams CLI commands', () => {
  it('T-TCLI1 teams:list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await listMain([]);
    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listTeams())}\n`);
    stdout.mockRestore();
  });

  it('T-TCLI2 teams:inspect requires --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await inspectMain([]);
    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --team');
    stdout.mockRestore();
  });

  it('T-TCLI3 teams:status routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await statusMain(['--team', 'venture-opportunity-team']);
    expect(code).toBe(0);
    expect(getTeamStatus).toHaveBeenCalledWith('venture-opportunity-team');
    stdout.mockRestore();
  });

  it('T-TCLI4 teams:history routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await historyMain(['--team=venture-opportunity-team']);
    expect(code).toBe(0);
    expect(getTeamHistory).toHaveBeenCalledWith('venture-opportunity-team');
    stdout.mockRestore();
  });

  it('T-TCLI5 teams:materialize routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await materializeMain(['--team', 'venture-opportunity-team']);
    expect(code).toBe(0);
    expect(materializeTeam).toHaveBeenCalledWith('venture-opportunity-team');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeTeam())}\n`);
    stdout.mockRestore();
  });

  it('T-TCLI6 stable error payload', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectTeam.mockImplementationOnce(() => {
      throw new Error('TEAM_NOT_FOUND: missing');
    });

    const code = await inspectMain(['--team', 'missing']);
    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'TEAM_NOT_FOUND: missing' })}\n`);
    stdout.mockRestore();
  });
});
