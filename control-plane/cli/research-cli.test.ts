import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main as datasetsInspectMain } from './research-datasets-inspect.ts';
import { main as packInspectMain } from './research-pack-inspect.ts';
import { main as packsListMain } from './research-packs-list.ts';
import { main as researchTickMain } from './research-scheduler-tick.ts';
import { main as teamInspectMain } from './research-team-inspect.ts';
import { main as teamsListMain } from './research-teams-list.ts';

const { listTeams, inspectTeamRuntime, listPacks, showPack, inspectDatasets } = vi.hoisted(() => ({
  listTeams: vi.fn(() => [{ teamId: 'defi-intelligence' }]),
  inspectTeamRuntime: vi.fn(() => ({
    team: { teamId: 'defi-intelligence' },
    pack: { packId: 'defi-intelligence' },
    datasets: [],
    latestSummary: null
  })),
  listPacks: vi.fn(() => [{ packId: 'defi-intelligence' }]),
  showPack: vi.fn(() => ({ packId: 'defi-intelligence' })),
  inspectDatasets: vi.fn(() => [{ datasetKey: 'yield_rate_history', recordCount: 1 }])
}));

const { processLaunch } = vi.hoisted(() => ({
  processLaunch: vi.fn(() => [{
    teamId: 'defi-intelligence',
    packId: 'defi-intelligence',
    scheduleId: 'defi-yield-hourly-scan',
    launchKey: 'k',
    processed: true,
    updatedDatasets: ['yield_rate_history'],
    summaryGenerated: false
  }])
}));

const { tick } = vi.hoisted(() => ({
  tick: vi.fn(async () => ({ tickTimeUtc: '2026-03-10T13:00:00.000Z', evaluations: [], launches: [] }))
}));

vi.mock('../research/inspection.ts', () => ({
  createResearchInspection: vi.fn(() => ({
    listTeams,
    inspectTeamRuntime,
    listPacks,
    showPack,
    inspectDatasets
  }))
}));

vi.mock('../research/runtime.ts', () => ({
  createResearchRuntime: vi.fn(() => ({
    processLaunch
  }))
}));

vi.mock('../scheduler/service.ts', () => ({
  createSchedulerService: vi.fn((options?: { onLaunchRecord?: (launch: unknown) => void }) => ({
    async tick() {
      if (options?.onLaunchRecord) {
        options.onLaunchRecord({
          scheduleId: 'defi-yield-hourly-scan',
          missionId: 'defi-yield-report',
          slotId: 'interval_hours:6:2026-03-10T12:00Z',
          dueDecision: 'due',
          launched: true,
          runId: 'run_1',
          attemptedAtUtc: '2026-03-10T12:01:00.000Z'
        });
      }
      return tick();
    }
  }))
}));

describe('research CLI commands', () => {
  it('T-CLI1 teams list prints deterministic JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await teamsListMain([]);
    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify([{ teamId: 'defi-intelligence' }])}\n`);
    stdout.mockRestore();
  });

  it('T-CLI2 team inspect requires --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await teamInspectMain([]);
    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --team' })}\n`);
    stdout.mockRestore();
  });

  it('T-CLI3 packs list prints deterministic JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await packsListMain([]);
    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify([{ packId: 'defi-intelligence' }])}\n`);
    stdout.mockRestore();
  });

  it('T-CLI4 pack inspect routes --pack', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await packInspectMain(['--pack', 'defi-intelligence']);
    expect(code).toBe(0);
    expect(showPack).toHaveBeenLastCalledWith('defi-intelligence');
    stdout.mockRestore();
  });

  it('T-CLI5 datasets inspect routes --team', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await datasetsInspectMain(['--team', 'defi-intelligence']);
    expect(code).toBe(0);
    expect(inspectDatasets).toHaveBeenLastCalledWith('defi-intelligence');
    stdout.mockRestore();
  });

  it('T-CLI6 research scheduler tick includes deterministic research outcomes', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await researchTickMain([]);
    expect(code).toBe(0);
    expect(processLaunch).toHaveBeenCalledTimes(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('research');
    stdout.mockRestore();
  });
});
