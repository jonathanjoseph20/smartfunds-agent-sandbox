import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './mission-run.ts';

const startMission = vi.fn();

vi.mock('../operator/mission-service.ts', () => ({
  createMissionService: vi.fn(() => ({
    startMission
  }))
}));

describe('mission-run CLI', () => {
  it('prints deterministic mission execution output and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    startMission.mockResolvedValueOnce({
      contextKeys: ['missionParameters', 'sector', 'targetAssets'],
      teamId: 'smartfunds-research-team',
      workflowId: 'research-analysis-workflow',
      missionId: 'rwa-market-analysis',
      missionParameters: {},
      status: 'completed',
      workflowRun: 'run_smartfunds-core_0001'
    });

    const code = await main(['--mission', 'rwa-market-analysis']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      contextKeys: ['missionParameters', 'sector', 'targetAssets'],
      teamId: 'smartfunds-research-team',
      workflowId: 'research-analysis-workflow',
      missionId: 'rwa-market-analysis',
      missionParameters: {},
      status: 'completed',
      workflowRun: 'run_smartfunds-core_0001'
    })}\n`);

    stdout.mockRestore();
  });

  it('prints stable error output for missing mission argument and exits 1', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --mission' })}\n`);

    stdout.mockRestore();
  });
});
