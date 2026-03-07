import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './agent-inspect.ts';

const { loadAgentProfilesFromDir, loadTeamDefinitionsFromDir } = vi.hoisted(() => ({
  loadAgentProfilesFromDir: vi.fn(),
  loadTeamDefinitionsFromDir: vi.fn()
}));

vi.mock('../agents/agent-profile-loader.ts', () => ({
  loadAgentProfilesFromDir
}));

vi.mock('../teams/team-loader.ts', () => ({
  loadTeamDefinitionsFromDir
}));

describe('agent-inspect CLI', () => {
  it('prints deterministic agent runtime inspection payload and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    loadAgentProfilesFromDir.mockReturnValueOnce([
      {
        agentId: 'lead-thesis-architect',
        displayName: 'Lead Thesis Architect',
        role: 'research-lead',
        projectId: 'smartfunds-core',
        adapterType: 'llm',
        personalityProfile: {
          tone: 'measured',
          reasoningStyle: 'top-down',
          temperament: 'calm',
          collaborationStyle: 'delegates',
          communicationStyle: 'structured'
        },
        skillsProfile: {
          coreSkills: ['market synthesis'],
          secondarySkills: ['summarization'],
          domains: ['RWA']
        },
        backgroundProfile: {
          professionalArchetype: 'strategist',
          domainBackground: ['private markets'],
          perspectiveBiases: ['asymmetric opportunities']
        },
        outputProfile: {
          preferredFormat: 'memo',
          verbosity: 'medium',
          citationStyle: 'internal',
          decisionStyle: 'rank'
        },
        constraintsProfile: {
          mustDo: ['state assumptions'],
          mustNotDo: ['overstate market size']
        },
        toolProfile: {
          allowedAdapters: ['llm', 'repo'],
          preferredTools: ['llm'],
          forbiddenTools: ['shell']
        }
      }
    ]);

    loadTeamDefinitionsFromDir.mockReturnValueOnce([
      {
        teamId: 'smartfunds-research-team',
        projectId: 'smartfunds-core',
        members: ['lead-thesis-architect'],
        executionMode: 'structured'
      }
    ]);

    const code = await main(['--agent', 'lead-thesis-architect']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      agentId: 'lead-thesis-architect',
      profile: {
        agentId: 'lead-thesis-architect',
        displayName: 'Lead Thesis Architect',
        role: 'research-lead',
        projectId: 'smartfunds-core',
        adapterType: 'llm',
        personalityProfile: {
          tone: 'measured',
          reasoningStyle: 'top-down',
          temperament: 'calm',
          collaborationStyle: 'delegates',
          communicationStyle: 'structured'
        },
        skillsProfile: {
          coreSkills: ['market synthesis'],
          secondarySkills: ['summarization'],
          domains: ['RWA']
        },
        backgroundProfile: {
          professionalArchetype: 'strategist',
          domainBackground: ['private markets'],
          perspectiveBiases: ['asymmetric opportunities']
        },
        outputProfile: {
          preferredFormat: 'memo',
          verbosity: 'medium',
          citationStyle: 'internal',
          decisionStyle: 'rank'
        },
        constraintsProfile: {
          mustDo: ['state assumptions'],
          mustNotDo: ['overstate market size']
        },
        toolProfile: {
          allowedAdapters: ['llm', 'repo'],
          preferredTools: ['llm'],
          forbiddenTools: ['shell']
        }
      },
      executionEnvelope: {
        agentId: 'lead-thesis-architect',
        role: 'research-lead',
        personality: {
          collaborationStyle: 'delegates',
          communicationStyle: 'structured',
          reasoningStyle: 'top-down',
          temperament: 'calm',
          tone: 'measured'
        },
        skills: ['market synthesis', 'RWA', 'summarization'],
        background: {
          domainBackground: ['private markets'],
          perspectiveBiases: ['asymmetric opportunities'],
          professionalArchetype: 'strategist'
        },
        outputStyle: {
          citationStyle: 'internal',
          decisionStyle: 'rank',
          preferredFormat: 'memo',
          verbosity: 'medium'
        },
        constraints: {
          mustDo: ['state assumptions'],
          mustNotDo: ['overstate market size']
        },
        allowedTools: ['llm', 'repo']
      },
      permissions: {
        allowedAdapters: ['llm', 'repo'],
        forbiddenAdapters: ['shell']
      },
      teams: [{
        teamId: 'smartfunds-research-team',
        projectId: 'smartfunds-core',
        executionMode: 'structured'
      }]
    })}\n`);

    stdout.mockRestore();
  });

  it('prints stable error output and exits 1', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    loadAgentProfilesFromDir.mockReturnValueOnce([]);

    const code = await main(['--agent', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(
      `${canonicalStringify({ error: 'ERR_AGENT_NOT_FOUND: Agent profile not found: missing' })}\n`
    );

    stdout.mockRestore();
  });
});
