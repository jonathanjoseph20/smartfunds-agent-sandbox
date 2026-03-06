import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './mission-run.ts';

const runMission = vi.fn();

vi.mock('../missions/mission-runner.ts', () => ({
  createMissionRunner: vi.fn(() => ({
    runMission
  }))
}));

describe('mission-run CLI', () => {
  it('prints deterministic mission execution output and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runMission.mockResolvedValueOnce({
      mission: {
        missionId: 'rwa-market-analysis'
      },
      teamId: 'smartfunds-research-team',
      workflowId: 'research-analysis-workflow',
      agentRoster: ['a', 'b'],
      runSummary: {
        runId: 'run_smartfunds-core_0001',
        status: 'completed',
        currentPhase: 'release',
        completedPhases: ['plan', 'setup', 'implement', 'verify', 'test', 'release'],
        eventCount: 27
      }
    });

    const code = await main(['--mission', 'rwa-market-analysis']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      mission: {
        missionId: 'rwa-market-analysis'
      },
      teamId: 'smartfunds-research-team',
      workflowId: 'research-analysis-workflow',
      agentRoster: ['a', 'b'],
      runSummary: {
        runId: 'run_smartfunds-core_0001',
        status: 'completed',
        currentPhase: 'release',
        completedPhases: ['plan', 'setup', 'implement', 'verify', 'test', 'release'],
        eventCount: 27
      }
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
