import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './team-inspect.ts';

const { loadAgentProfilesFromDir, loadTeamDefinitionById } = vi.hoisted(() => ({
  loadAgentProfilesFromDir: vi.fn(),
  loadTeamDefinitionById: vi.fn()
}));

vi.mock('../agents/agent-profile-loader.ts', () => ({
  loadAgentProfilesFromDir
}));

vi.mock('../teams/team-loader.ts', () => ({
  loadTeamDefinitionById
}));

describe('team-inspect CLI', () => {
  it('prints deterministic team inspection output and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    loadAgentProfilesFromDir.mockReturnValueOnce([
      {
        agentId: 'lead-thesis-architect',
        displayName: 'Lead Thesis Architect',
        role: 'research-lead',
        adapterType: 'llm',
        toolProfile: {
          allowedAdapters: ['llm', 'repo']
        }
      }
    ]);

    loadTeamDefinitionById.mockReturnValueOnce({
      teamId: 'smartfunds-research-team',
      name: 'SmartFunds Research Team',
      projectId: 'smartfunds-core',
      executionMode: 'structured',
      members: ['lead-thesis-architect']
    });

    const code = await main(['--team', 'smartfunds-research-team']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      team: {
        teamId: 'smartfunds-research-team',
        name: 'SmartFunds Research Team',
        projectId: 'smartfunds-core',
        executionMode: 'structured'
      },
      members: ['lead-thesis-architect'],
      agentSummaries: [
        {
          agentId: 'lead-thesis-architect',
          displayName: 'Lead Thesis Architect',
          role: 'research-lead',
          adapterType: 'llm',
          adapterCompatibility: true
        }
      ],
      adapterCompatibility: true
    })}\n`);

    stdout.mockRestore();
  });

  it('prints stable error output for missing team arg and exits 1', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --team' })}\n`);

    stdout.mockRestore();
  });
});
