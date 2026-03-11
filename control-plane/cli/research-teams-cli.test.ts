import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as coordinationMain } from './research-teams-coordination.ts';
import { main as historyMain } from './research-teams-history.ts';
import { main as inspectMain } from './research-teams-inspect.ts';
import { main as linksMain } from './research-teams-links.ts';
import { main as listMain } from './research-teams-list.ts';
import { main as materializeMain } from './research-teams-materialize.ts';
import { main as policyMain } from './research-teams-policy.ts';
import { main as prioritiesMain } from './research-teams-priorities.ts';
import { main as statusMain } from './research-teams-status.ts';
import { main as stabilizationMain } from './research-teams-stabilization.ts';

const {
  listTeams,
  inspectTeam,
  inspectStatus,
  inspectLinks,
  inspectHistory,
  materializeTeam,
  inspectCoordination,
  inspectCoordinationPolicy,
  inspectCoordinationPriorities,
  inspectCoordinationStabilization
} = vi.hoisted(() => ({
  listTeams: vi.fn(() => [{ teamId: 'defi-risk-team', displayName: 'DeFi Risk Research Team', teamType: 'risk_monitoring', enabled: true }]),
  inspectTeam: vi.fn(() => ({ team: { teamId: 'defi-risk-team' }, status: { activityState: 'monitoring' } })),
  inspectStatus: vi.fn(() => ({ teamId: 'defi-risk-team', activityState: 'monitoring', healthState: 'healthy' })),
  inspectLinks: vi.fn(() => ({ teamId: 'defi-risk-team', cohorts: ['aave-risk'], programs: ['aave-risk-monitor'], investigations: ['i1'], syntheses: ['s1'] })),
  inspectHistory: vi.fn(() => ({ teamId: 'defi-risk-team', entries: [] })),
  materializeTeam: vi.fn(() => ({ teamId: 'defi-risk-team', statusPath: 'a', historyPath: 'b', reportPath: 'c' })),
  inspectCoordination: vi.fn(() => ({
    teamId: 'defi-risk-team',
    priority: 'high',
    readiness: 'engaged',
    activeInvestigations: ['i1'],
    stabilizationState: 'stabilizing'
  })),
  inspectCoordinationPolicy: vi.fn(() => ({ teamId: 'defi-risk-team', routingRules: [] })),
  inspectCoordinationPriorities: vi.fn(() => ({ teamId: 'defi-risk-team', priority: 'high', priorityEvaluation: { appliedRule: 'escalated' } })),
  inspectCoordinationStabilization: vi.fn(() => ({ teamId: 'defi-risk-team', stabilizationState: 'stabilizing' }))
}));

const { listLegacyTeams } = vi.hoisted(() => ({
  listLegacyTeams: vi.fn(() => [{ teamId: 'defi-intelligence' }])
}));

vi.mock('../research-teams/research-team-inspection.ts', () => ({
  createResearchTeamInspection: vi.fn(() => ({
    listTeams,
    inspectTeam,
    inspectStatus,
    inspectLinks,
    inspectHistory,
    materializeTeam,
    inspectCoordination,
    inspectCoordinationPolicy,
    inspectCoordinationPriorities,
    inspectCoordinationStabilization
  }))
}));

vi.mock('../research/inspection.ts', () => ({
  createResearchInspection: vi.fn(() => ({
    listTeams: listLegacyTeams
  }))
}));

describe('research teams CLI commands', () => {
  it('T-RT-CLI1 research-teams:list supports legacy default and bounded mode', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const legacyCode = await listMain([]);
    const boundedCode = await listMain(['--bounded']);

    expect(legacyCode).toBe(0);
    expect(boundedCode).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listLegacyTeams())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listTeams())}\n`);
    stdout.mockRestore();
  });

  it('T-RT-CLI2 research-teams:inspect requires --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --team');
    stdout.mockRestore();
  });

  it('T-RT-CLI3 research-teams:status routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--team', 'defi-risk-team']);

    expect(code).toBe(0);
    expect(inspectStatus).toHaveBeenCalledWith('defi-risk-team');
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectStatus())}\n`);
    stdout.mockRestore();
  });

  it('T-RT-CLI4 research-teams:links routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await linksMain(['--team=defi-risk-team']);

    expect(code).toBe(0);
    expect(inspectLinks).toHaveBeenCalledWith('defi-risk-team');
    stdout.mockRestore();
  });

  it('T-RT-CLI5 research-teams:history routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--team', 'defi-risk-team']);

    expect(code).toBe(0);
    expect(inspectHistory).toHaveBeenCalledWith('defi-risk-team');
    stdout.mockRestore();
  });

  it('T-RT-CLI6 research-teams:materialize supports --slot and returns materialized paths', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await materializeMain(['--team', 'defi-risk-team', '--slot', 'daily:2026-03-11']);

    expect(code).toBe(0);
    expect(materializeTeam).toHaveBeenCalledWith({
      teamId: 'defi-risk-team',
      slotReference: 'daily:2026-03-11'
    });
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeTeam())}\n`);
    stdout.mockRestore();
  });

  it('T-RT-CLI7 research-teams:coordination returns bounded coordination state', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await coordinationMain(['--team', 'defi-risk-team']);

    expect(code).toBe(0);
    expect(inspectCoordination).toHaveBeenCalledWith('defi-risk-team');
    stdout.mockRestore();
  });

  it('T-RT-CLI8 research-teams:policy routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await policyMain(['--team', 'defi-risk-team']);

    expect(code).toBe(0);
    expect(inspectCoordinationPolicy).toHaveBeenCalledWith('defi-risk-team');
    stdout.mockRestore();
  });

  it('T-RT-CLI9 research-teams:priorities routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await prioritiesMain(['--team=defi-risk-team']);

    expect(code).toBe(0);
    expect(inspectCoordinationPriorities).toHaveBeenCalledWith('defi-risk-team');
    stdout.mockRestore();
  });

  it('T-RT-CLI10 research-teams:stabilization routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await stabilizationMain(['--team', 'defi-risk-team']);

    expect(code).toBe(0);
    expect(inspectCoordinationStabilization).toHaveBeenCalledWith('defi-risk-team');
    stdout.mockRestore();
  });
});
