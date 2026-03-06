import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './mission-inspect.ts';

const inspectMission = vi.fn();

vi.mock('../missions/mission-runner.ts', () => ({
  createMissionRunner: vi.fn(() => ({
    inspectMission
  }))
}));

describe('mission-inspect CLI', () => {
  it('prints deterministic inspection output and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    inspectMission.mockReturnValueOnce({
      mission: {
        missionId: 'rwa-market-analysis',
        name: 'RWA Market Opportunity Analysis',
        objective: 'Analyze near-term tokenized RWA opportunities.',
        projectId: 'smartfunds-core'
      },
      workflowId: 'research-analysis-workflow',
      team: {
        teamId: 'smartfunds-research-team',
        name: 'SmartFunds Research Team',
        executionMode: 'structured'
      },
      agentRoster: [
        { agentId: 'agent-a', displayName: 'Agent A', role: 'lead', adapterType: 'llm' }
      ],
      initialContext: {
        sector: 'RWA'
      }
    });

    const code = await main(['--mission', 'rwa-market-analysis']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      mission: {
        missionId: 'rwa-market-analysis',
        name: 'RWA Market Opportunity Analysis',
        objective: 'Analyze near-term tokenized RWA opportunities.',
        projectId: 'smartfunds-core'
      },
      workflow: 'research-analysis-workflow',
      team: {
        teamId: 'smartfunds-research-team',
        name: 'SmartFunds Research Team',
        executionMode: 'structured'
      },
      agentRoster: [
        { agentId: 'agent-a', displayName: 'Agent A', role: 'lead', adapterType: 'llm' }
      ],
      initialContext: {
        sector: 'RWA'
      }
    })}\n`);

    stdout.mockRestore();
  });

  it('prints stable error output for unknown args and exits 1', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main(['--team', 'smartfunds-research-team']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --team' })}\n`);

    stdout.mockRestore();
  });
});
