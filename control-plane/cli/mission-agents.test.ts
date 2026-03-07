import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './mission-agents.ts';

const { createMissionRunner, inspectMission } = vi.hoisted(() => ({
  inspectMission: vi.fn(),
  createMissionRunner: vi.fn(() => ({
    inspectMission
  }))
}));

vi.mock('../missions/mission-runner.ts', () => ({
  createMissionRunner
}));

describe('mission-agents CLI', () => {
  it('prints deterministic mission roster with runtime envelopes and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    inspectMission.mockReturnValueOnce({
      mission: {
        missionId: 'rwa-market-analysis',
        projectId: 'smartfunds-core'
      },
      team: {
        teamId: 'smartfunds-research-team'
      },
      workflowId: 'research-analysis-workflow',
      agentRoster: [
        {
          agentId: 'macro-signal-analyst',
          role: 'macro-analyst',
          personalityProfile: {
            tone: 'analytical',
            reasoningStyle: 'evidence-first',
            temperament: 'skeptical',
            collaborationStyle: 'iterative',
            communicationStyle: 'concise'
          },
          skillsProfile: {
            coreSkills: ['macro analysis'],
            secondarySkills: ['risk framing'],
            domains: ['credit']
          },
          backgroundProfile: {
            professionalArchetype: 'strategist',
            domainBackground: ['fixed income'],
            perspectiveBiases: []
          },
          outputProfile: {
            preferredFormat: 'brief',
            verbosity: 'medium',
            citationStyle: 'internal',
            decisionStyle: 'tradeoffs'
          },
          constraintsProfile: {
            mustDo: ['differentiate scenarios'],
            mustNotDo: ['hide uncertainty']
          },
          toolProfile: {
            allowedAdapters: ['llm', 'repo'],
            preferredTools: ['llm'],
            forbiddenTools: ['shell']
          },
          adapterType: 'llm'
        }
      ]
    });

    const code = await main(['--mission', 'rwa-market-analysis']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      mission: {
        missionId: 'rwa-market-analysis',
        projectId: 'smartfunds-core',
        teamId: 'smartfunds-research-team',
        workflowId: 'research-analysis-workflow'
      },
      roster: [{
        agentId: 'macro-signal-analyst',
        role: 'macro-analyst',
        allowedTools: ['llm', 'repo'],
        adapterType: 'llm'
      }]
    })}\n`);

    stdout.mockRestore();
  });

  it('prints deterministic error output and exits 1', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(
      `${canonicalStringify({ error: 'MISSING_ARGUMENT: --mission' })}\n`
    );

    stdout.mockRestore();
  });
});
