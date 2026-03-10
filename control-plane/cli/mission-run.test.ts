import { describe, expect, it, vi } from 'vitest';

import { main } from './mission-run.ts';

const startMission = vi.fn();

vi.mock('../operator/mission-service.ts', () => ({
  createMissionService: vi.fn(() => ({
    startMission
  }))
}));

describe('mission-run CLI', () => {
  it('prints deterministic readable mission execution output and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    startMission.mockResolvedValueOnce({
      contextKeys: ['missionParameters', 'sector', 'targetAssets'],
      teamId: 'smartfunds-research-team',
      workflowId: 'research-analysis-workflow',
      missionId: 'rwa-market-analysis',
      missionParameters: {},
      status: 'completed',
      workflowRun: 'run_smartfunds-core_0001',
      profile: 'lite',
      artifactCount: 2
    });

    const code = await main(['--mission', 'rwa-market-analysis']);

    expect(code).toBe(0);
    const output = stdout.mock.calls.map((call) => String(call[0])).join('');
    expect(output).toContain('Mission: rwa-market-analysis');
    expect(output).toContain('Profile: lite');
    expect(output).toContain('Run: run_smartfunds-core_0001');
    expect(output).toContain('Status: completed');
    expect(output).toContain('Artifacts: 2');

    stdout.mockRestore();
  });

  it('prints stable error output for missing mission argument and exits 1', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main([]);

    expect(code).toBe(1);
    const output = stdout.mock.calls.map((call) => String(call[0])).join('');
    expect(output).toContain('Mission rejected');
    expect(output).toContain('Code: MISSING_ARGUMENT');
    expect(output).toContain('Reason: --mission');
    stdout.mockRestore();
  });

  it('passes profile override to mission service', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    startMission.mockResolvedValueOnce({
      missionId: 'rwa-market-analysis',
      status: 'completed',
      profile: 'lite',
      workflowRun: 'run_smartfunds-core_0001',
      artifactCount: 1
    });

    const code = await main(['--mission', 'rwa-market-analysis', '--profile', 'lite', '--json']);
    expect(code).toBe(0);
    expect(startMission).toHaveBeenLastCalledWith({
      missionId: 'rwa-market-analysis',
      params: {},
      profile: 'lite'
    });

    stdout.mockRestore();
  });
});
