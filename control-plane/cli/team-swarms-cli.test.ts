import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as historyMain } from './team-swarms-history.ts';
import { main as inspectMain } from './team-swarms-inspect.ts';
import { main as listMain } from './team-swarms-list.ts';
import { main as prioritiesMain } from './team-swarms-priorities.ts';
import { main as statusMain } from './team-swarms-status.ts';

const {
  listTeams,
  inspectTeam,
  getTeamStatus,
  getTeamPriorities,
  getTeamHistory
} = vi.hoisted(() => ({
  listTeams: vi.fn(() => [{ teamId: 'defi-risk-team', teamDisplayName: 'DeFi Risk Research Team', teamEnabled: true, swarmCount: 1 }]),
  inspectTeam: vi.fn(() => ({ teamId: 'defi-risk-team', topicProgress: { progress: 'active' } })),
  getTeamStatus: vi.fn(() => ({ teamId: 'defi-risk-team', topicProgress: { progress: 'active' }, swarms: [] })),
  getTeamPriorities: vi.fn(() => ({ teamId: 'defi-risk-team', priorities: [{ swarmId: 'protocol-risk-response', priority: 'high' }] })),
  getTeamHistory: vi.fn(() => ({ teamId: 'defi-risk-team', entries: [] }))
}));

vi.mock('../team-swarm-coordination/team-swarm-inspection.ts', () => ({
  createTeamSwarmInspection: vi.fn(() => ({
    listTeams,
    inspectTeam,
    getTeamStatus,
    getTeamPriorities,
    getTeamHistory
  }))
}));

describe('team swarms CLI commands', () => {
  it('T-TS-CLI1 team-swarms:list prints deterministic output', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listTeams())}\n`);
    stdout.mockRestore();
  });

  it('T-TS-CLI2 team-swarms:inspect requires --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --team');
    stdout.mockRestore();
  });

  it('T-TS-CLI3 team-swarms:status routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--team', 'defi-risk-team']);

    expect(code).toBe(0);
    expect(getTeamStatus).toHaveBeenCalledWith('defi-risk-team');
    stdout.mockRestore();
  });

  it('T-TS-CLI4 team-swarms:priorities routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await prioritiesMain(['--team=defi-risk-team']);

    expect(code).toBe(0);
    expect(getTeamPriorities).toHaveBeenCalledWith('defi-risk-team');
    stdout.mockRestore();
  });

  it('T-TS-CLI5 team-swarms:history routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--team', 'defi-risk-team']);

    expect(code).toBe(0);
    expect(getTeamHistory).toHaveBeenCalledWith('defi-risk-team');
    stdout.mockRestore();
  });
});
