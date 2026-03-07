import { describe, expect, it } from 'vitest';

import type { AgentProfileDefinition } from '../../agent-profile-types.ts';
import { buildAgentExecutionEnvelope } from '../agent-envelope.ts';

function createProfile(overrides: Partial<AgentProfileDefinition> = {}): AgentProfileDefinition {
  return {
    agentId: 'macro-signal-analyst',
    displayName: 'Macro Signal Analyst',
    role: 'macro-analyst',
    projectId: 'smartfunds-core',
    adapterType: 'llm',
    personalityProfile: {
      tone: 'analytical',
      reasoningStyle: 'evidence-first',
      temperament: 'calm',
      collaborationStyle: 'iterative',
      communicationStyle: 'concise'
    },
    skillsProfile: {
      coreSkills: ['macro analysis', 'scenario building'],
      secondarySkills: ['risk framing'],
      domains: ['credit', 'tokenization']
    },
    backgroundProfile: {
      professionalArchetype: 'macro strategist',
      domainBackground: ['fixed income', 'liquidity cycles'],
      perspectiveBiases: ['downside containment']
    },
    outputProfile: {
      preferredFormat: 'analysis brief',
      verbosity: 'medium',
      citationStyle: 'internal evidence references',
      decisionStyle: 'state tradeoffs'
    },
    constraintsProfile: {
      mustDo: ['differentiate scenarios'],
      mustNotDo: ['hide uncertainty']
    },
    toolProfile: {
      allowedAdapters: ['repo', 'llm', 'shell'],
      preferredTools: ['llm'],
      forbiddenTools: ['shell']
    },
    ...overrides
  };
}

describe('agent envelope', () => {
  it('T-AR1 maps profile to deterministic execution envelope', () => {
    const profile = createProfile();
    const envelope = buildAgentExecutionEnvelope(profile);

    expect(envelope).toEqual({
      agentId: 'macro-signal-analyst',
      role: 'macro-analyst',
      personality: {
        collaborationStyle: 'iterative',
        communicationStyle: 'concise',
        reasoningStyle: 'evidence-first',
        temperament: 'calm',
        tone: 'analytical'
      },
      skills: [
        'credit',
        'macro analysis',
        'risk framing',
        'scenario building',
        'tokenization'
      ],
      background: {
        domainBackground: ['fixed income', 'liquidity cycles'],
        perspectiveBiases: ['downside containment'],
        professionalArchetype: 'macro strategist'
      },
      outputStyle: {
        citationStyle: 'internal evidence references',
        decisionStyle: 'state tradeoffs',
        preferredFormat: 'analysis brief',
        verbosity: 'medium'
      },
      constraints: {
        mustDo: ['differentiate scenarios'],
        mustNotDo: ['hide uncertainty']
      },
      allowedTools: ['llm', 'repo']
    });
  });

  it('T-AR2 keeps deterministic ordering for repeated calls and freezes the envelope', () => {
    const profile = createProfile({
      skillsProfile: {
        coreSkills: ['b', 'a'],
        secondarySkills: ['c'],
        domains: ['d', 'a']
      },
      toolProfile: {
        allowedAdapters: ['shell', 'llm', 'repo'],
        preferredTools: ['repo'],
        forbiddenTools: ['shell']
      }
    });

    const first = buildAgentExecutionEnvelope(profile);
    const second = buildAgentExecutionEnvelope(profile);

    expect(first).toEqual(second);
    expect(first.skills).toEqual(['a', 'b', 'c', 'd']);
    expect(first.allowedTools).toEqual(['llm', 'repo']);

    expect(() => {
      (first.allowedTools as string[]).push('shell');
    }).toThrow();
  });
});
