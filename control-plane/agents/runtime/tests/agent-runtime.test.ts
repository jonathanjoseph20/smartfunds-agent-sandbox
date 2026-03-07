import { describe, expect, it } from 'vitest';

import type { AgentProfileDefinition } from '../../agent-profile-types.ts';
import { createExecutionContext } from '../../../execution/execution-context.ts';
import { resolveAgentProfile, resolveMissionAgentRoster, resolveTaskAgent } from '../agent-runtime.ts';

const profiles: AgentProfileDefinition[] = [
  {
    agentId: 'lead-thesis-architect',
    displayName: 'Lead Thesis Architect',
    role: 'research-lead',
    projectId: 'smartfunds-core',
    adapterType: 'llm',
    personalityProfile: {
      tone: 'measured',
      reasoningStyle: 'top-down synthesis',
      temperament: 'calm',
      collaborationStyle: 'delegates detail work',
      communicationStyle: 'structured'
    },
    skillsProfile: {
      coreSkills: ['market synthesis', 'thesis construction'],
      secondarySkills: ['summarization'],
      domains: ['RWA']
    },
    backgroundProfile: {
      professionalArchetype: 'buy-side strategist',
      domainBackground: ['private markets'],
      perspectiveBiases: ['asymmetric opportunities']
    },
    outputProfile: {
      preferredFormat: 'memo',
      verbosity: 'medium',
      citationStyle: 'internal',
      decisionStyle: 'rank and justify'
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
  {
    agentId: 'macro-signal-analyst',
    displayName: 'Macro Signal Analyst',
    role: 'macro-analyst',
    projectId: 'smartfunds-core',
    adapterType: 'llm',
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
      professionalArchetype: 'macro strategist',
      domainBackground: ['fixed income'],
      perspectiveBiases: ['downside containment']
    },
    outputProfile: {
      preferredFormat: 'analysis brief',
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
    }
  }
];

describe('agent runtime', () => {
  it('T-AR3 resolves deterministic mission roster from execution context metadata', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      missionId: 'rwa-market-analysis',
      teamId: 'smartfunds-research-team',
      phase: 'implement',
      taskId: 'research',
      metadata: {
        agentRoster: ['macro-signal-analyst', 'lead-thesis-architect', 'macro-signal-analyst']
      }
    });

    const roster = resolveMissionAgentRoster(context, profiles);

    expect(roster.map((entry) => entry.agentId)).toEqual([
      'lead-thesis-architect',
      'macro-signal-analyst'
    ]);
  });

  it('T-AR4 resolves task-bound agent and returns deterministic runtime payload', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      missionId: 'rwa-market-analysis',
      teamId: 'smartfunds-research-team',
      phase: 'implement',
      taskId: 'research',
      metadata: {
        teamId: 'smartfunds-research-team',
        agentRoster: ['lead-thesis-architect', 'macro-signal-analyst']
      }
    });

    const runtime = resolveTaskAgent({
      taskAgent: 'macro-signal-analyst',
      executionContext: context,
      profiles
    });

    expect(runtime).toMatchObject({
      teamId: 'smartfunds-research-team',
      activeAgent: 'macro-signal-analyst',
      agentEnvelope: {
        agentId: 'macro-signal-analyst',
        role: 'macro-analyst',
        allowedTools: ['llm', 'repo']
      }
    });
    expect(runtime.agentRoster.map((entry) => entry.agentId)).toEqual([
      'lead-thesis-architect',
      'macro-signal-analyst'
    ]);
  });

  it('T-AR5 fails deterministically for missing or unresolved task agent', () => {
    const context = createExecutionContext({
      runId: 'run_control-plane_0001',
      phase: 'implement',
      taskId: 'research',
      metadata: {
        agentRoster: ['lead-thesis-architect']
      }
    });

    expect(() => resolveAgentProfile({ agentId: 'missing-agent', profiles })).toThrow(
      'ERR_AGENT_NOT_FOUND: Agent profile not found: missing-agent'
    );

    expect(() => resolveTaskAgent({
      taskAgent: 'macro-signal-analyst',
      executionContext: context,
      profiles
    })).toThrow('ERR_TASK_AGENT_UNRESOLVED: Agent macro-signal-analyst is not part of the mission roster');
  });
});
